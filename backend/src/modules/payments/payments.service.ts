import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';

import { Payment } from './entities/payment.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { DiagnosticBooking } from '../diagnostic-bookings/entities/diagnostic-booking.entity.js';
import { TestRecommendation } from '../test-recommendations/entities/test-recommendation.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { CreateDiagnosticPaymentDto } from './dto/create-diagnostic-payment.dto.js';
import { PaymentQueryDto } from './dto/payment-query.dto.js';

import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { PaymentType } from '../../common/enums/payment-type.enum.js';
import { AppointmentStatus, CancelledBy } from '../../common/enums/appointment-status.enum.js';
import { DiagnosticBookingStatus } from '../../common/enums/diagnostic-booking-status.enum.js';
import { RecommendationStatus } from '../../common/enums/recommendation-status.enum.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';
import { formatPayment } from '../../common/utils/payment.util.js';
import { recordConsultationEarnings } from '../../common/utils/earnings.util.js';

const RELATIONS = {
  appointment: { patient: { user: true }, doctor: { user: true } },
  diagnosticBooking: { patient: { user: true }, recommendation: { diagnosticTest: true } },
} as const;

// Patient side: start, confirm and view own payments, for consultations
// and diagnostic tests. Reports and admin overrides are in payment-reports.
@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  // Lock the bare row first (FOR UPDATE can't be used with outer joins)
  private async lockRow<T extends object>(
    manager: EntityManager,
    entity: new () => T,
    id: string,
    relations: Record<string, unknown>,
    notFound: string,
  ): Promise<T> {
    const locked = await manager
      .getRepository(entity)
      .createQueryBuilder('row')
      .where('row.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();

    if (!locked) {
      throw new NotFoundException(notFound);
    }

    return manager.getRepository(entity).findOneOrFail({ where: { id } as never, relations: relations as never });
  }

  private holdExpired(appointment: Appointment) {
    return !appointment.holdExpiresAt || appointment.holdExpiresAt <= new Date();
  }

  private async expireAppointment(manager: EntityManager, appointment: Appointment) {
    appointment.status = AppointmentStatus.CANCELLED;
    appointment.holdExpiresAt = null;
    appointment.cancelledBy = CancelledBy.SYSTEM;
    appointment.cancellationReason = 'Payment hold expired';
    await manager.getRepository(Appointment).save(appointment);
  }

  // Returns the existing PENDING payment, or creates one
  private async pendingPayment(manager: EntityManager, target: Partial<Payment>, existingWhere: object) {
    const repo = manager.getRepository(Payment);
    const pending = await repo.findOne({ where: { ...existingWhere, status: PaymentStatus.PENDING } as never });
    return pending ?? repo.save(repo.create({ ...target, currency: 'BDT', status: PaymentStatus.PENDING }));
  }

  // Patient starts paying for a reserved appointment. Idempotent.
  async createPayment(userId: string, dto: CreatePaymentDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await this.lockRow(manager, Appointment, dto.appointmentId, { patient: { user: true } }, 'Appointment not found');

      if (appointment.patient.user.id !== userId) {
        throw new NotFoundException('Appointment not found');
      }

      if (await manager.getRepository(Payment).exists({ where: { appointment: { id: appointment.id }, status: PaymentStatus.PAID } })) {
        throw new ConflictException('This appointment is already paid');
      }

      if (appointment.status !== AppointmentStatus.PENDING_PAYMENT) {
        throw new BadRequestException('This appointment is not awaiting payment');
      }

      if (this.holdExpired(appointment)) {
        await this.expireAppointment(manager, appointment);
        return { expired: true as const };
      }

      const payment = await this.pendingPayment(
        manager,
        { paymentType: PaymentType.CONSULTATION, appointment, amount: appointment.consultationFee, paymentMethod: dto.paymentMethod },
        { appointment: { id: appointment.id } },
      );

      return { paymentId: payment.id };
    });

    // Thrown outside the transaction so the CANCELLED update is committed
    if ('expired' in result) {
      throw new BadRequestException('The payment hold for this appointment has expired. Please book another slot.');
    }

    return {
      message: 'Payment initiated. Confirm it to complete the booking.',
      payment: await this.findOneFormatted(result.paymentId),
    };
  }

  // Patient starts paying for an approved diagnostic test. Idempotent.
  async createDiagnosticPayment(userId: string, dto: CreateDiagnosticPaymentDto) {
    const paymentId = await this.dataSource.transaction(async (manager) => {
      const booking = await this.lockRow(manager, DiagnosticBooking, dto.diagnosticBookingId, { patient: { user: true } }, 'Diagnostic booking not found');

      if (booking.patient.user.id !== userId) {
        throw new NotFoundException('Diagnostic booking not found');
      }

      if (booking.status !== DiagnosticBookingStatus.PENDING_PAYMENT) {
        throw new ConflictException('This test booking is not awaiting payment');
      }

      const payment = await this.pendingPayment(
        manager,
        { paymentType: PaymentType.DIAGNOSTIC_TEST, diagnosticBooking: booking, amount: booking.price, paymentMethod: dto.paymentMethod },
        { diagnosticBooking: { id: booking.id } },
      );

      return payment.id;
    });

    return {
      message: 'Test payment initiated. Confirm it to confirm the booking.',
      payment: await this.findOneFormatted(paymentId),
    };
  }

  // Simulated gateway callback for both payment types.
  // Replace with a real gateway webhook later.
  async confirmPayment(userId: string, paymentId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await this.lockRow(manager, Payment, paymentId, RELATIONS, 'Payment not found');
      const owner = payment.appointment?.patient.user.id ?? payment.diagnosticBooking?.patient.user.id;

      if (owner !== userId) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === PaymentStatus.PAID) {
        return { alreadyConfirmed: true };
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new ConflictException('This payment cannot be confirmed');
      }

      return payment.paymentType === PaymentType.CONSULTATION
        ? this.confirmConsultation(manager, payment)
        : this.confirmDiagnostic(manager, payment);
    });

    if ('expired' in result) {
      throw new BadRequestException('Payment failed because the appointment hold expired');
    }

    return {
      message: result.alreadyConfirmed
        ? 'Payment was already confirmed'
        : 'Payment confirmed',
      payment: await this.findOneFormatted(paymentId),
    };
  }

  private markPaid(payment: Payment) {
    payment.status = PaymentStatus.PAID;
    payment.transactionId = `SIM-${randomUUID()}`;
    payment.paidAt = new Date();
  }

  // Appointment -> PENDING_DOCTOR, 50/50 earnings recorded, both sides notified
  private async confirmConsultation(manager: EntityManager, payment: Payment) {
    const appointment = await this.lockRow(manager, Appointment, payment.appointment!.id, { patient: { user: true }, doctor: { user: true } }, 'Appointment not found');

    if (appointment.status !== AppointmentStatus.PENDING_PAYMENT) {
      throw new ConflictException('This appointment cannot receive payment');
    }

    if (this.holdExpired(appointment)) {
      await this.expireAppointment(manager, appointment);
      payment.status = PaymentStatus.FAILED;
      await manager.getRepository(Payment).save(payment);
      return { expired: true as const };
    }

    this.markPaid(payment);
    appointment.status = AppointmentStatus.PENDING_DOCTOR;
    appointment.holdExpiresAt = null;

    await manager.getRepository(Payment).save(payment);
    await manager.getRepository(Appointment).save(appointment);
    await recordConsultationEarnings(manager, payment, appointment.doctor.user.id);

    const when = `${appointment.appointmentDate} at ${appointment.startTime.slice(0, 5)}`;

    await this.notifications.notify({
      userId: appointment.patient.user.id,
      type: NotificationType.APPOINTMENT_CONFIRMED,
      title: 'Appointment booked',
      message: `Payment received. Your appointment with ${appointment.doctor.user.fullName} on ${when} is waiting for the doctor to accept.`,
      relatedEntityType: 'appointment',
      relatedEntityId: appointment.id,
    }, manager);

    await this.notifications.notify({
      userId: appointment.doctor.user.id,
      type: NotificationType.APPOINTMENT_REQUEST,
      title: 'New appointment request',
      message: `${appointment.patient.user.fullName} (${appointment.patient.patientCode}) booked ${when}. Accept or reject it.`,
      relatedEntityType: 'appointment',
      relatedEntityId: appointment.id,
    }, manager);

    return { alreadyConfirmed: false };
  }

  // Test booking -> CONFIRMED, recommendation -> BOOKED, patient + center notified
  private async confirmDiagnostic(manager: EntityManager, payment: Payment) {
    const booking = await this.lockRow(manager, DiagnosticBooking, payment.diagnosticBooking!.id, {
      patient: { user: true },
      recommendation: { diagnosticTest: true },
    }, 'Diagnostic booking not found');

    if (booking.status !== DiagnosticBookingStatus.PENDING_PAYMENT) {
      throw new ConflictException('This test booking cannot receive payment');
    }

    this.markPaid(payment);
    booking.status = DiagnosticBookingStatus.CONFIRMED;

    await manager.getRepository(Payment).save(payment);
    await manager.getRepository(DiagnosticBooking).save(booking);
    await manager.getRepository(TestRecommendation).update(booking.recommendation.id, { status: RecommendationStatus.BOOKED });

    const testName = booking.recommendation.diagnosticTest.testName;

    await this.notifications.notify({
      userId: booking.patient.user.id,
      type: NotificationType.TEST_BOOKING_CONFIRMED,
      title: 'Test booking confirmed',
      message: `Your ${testName} is booked for ${booking.bookingDate}.`,
      relatedEntityType: 'diagnostic_booking',
      relatedEntityId: booking.id,
    }, manager);

    await this.notifications.notifyRole(UserRole.DIAGNOSTIC_CENTER, {
      type: NotificationType.TEST_BOOKING_CONFIRMED,
      title: 'New confirmed test booking',
      message: `${testName} for patient ${booking.patient.patientCode} on ${booking.bookingDate}.`,
      relatedEntityType: 'diagnostic_booking',
      relatedEntityId: booking.id,
    }, manager);

    return { alreadyConfirmed: false };
  }

  private async findOneFormatted(id: string) {
    return formatPayment(await this.dataSource.getRepository(Payment).findOneOrFail({ where: { id }, relations: RELATIONS }));
  }

  // Patient: both payment types, newest first
  async findMyPayments(userId: string, query: PaymentQueryDto) {
    const { page, limit } = query;
    const type = query.type ? { paymentType: query.type } : {};

    const [items, total] = await this.dataSource.getRepository(Payment).findAndCount({
      where: [
        { ...type, appointment: { patient: { user: { id: userId } } } },
        { ...type, diagnosticBooking: { patient: { user: { id: userId } } } },
      ],
      relations: RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items.map(formatPayment), total, page, limit);
  }

  async findOne(id: string, user: AuthUser) {
    const payment = await this.dataSource.getRepository(Payment).findOne({ where: { id }, relations: RELATIONS });
    const owner = payment?.appointment?.patient.user.id ?? payment?.diagnosticBooking?.patient.user.id;

    if (!payment || (user.role !== UserRole.ADMIN && owner !== user.id)) {
      throw new NotFoundException('Payment not found');
    }

    return formatPayment(payment);
  }
}
