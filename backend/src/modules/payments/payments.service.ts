import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';

import { Payment } from './entities/payment.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { formatPayment } from '../../common/utils/payment.util.js';

// Patient side: start, confirm and view own payments.
// Revenue reports and admin status changes are in payment-reports.
@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  private async lockAppointment(manager: EntityManager, id: string) {
    const locked = await manager
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .where('appointment.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();

    if (!locked) {
      throw new NotFoundException('Appointment not found');
    }

    return manager.getRepository(Appointment).findOneOrFail({
      where: { id },
      relations: { patient: { user: true } },
    });
  }

  private holdExpired(appointment: Appointment) {
    return !appointment.holdExpiresAt || appointment.holdExpiresAt <= new Date();
  }

  // Patient starts a payment. Idempotent: returns the existing
  // PENDING payment instead of creating duplicates.
  async createPayment(userId: string, dto: CreatePaymentDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await this.lockAppointment(manager, dto.appointmentId);

      if (appointment.patient.user.id !== userId) {
        throw new NotFoundException('Appointment not found');
      }

      const repo = manager.getRepository(Payment);

      const paid = await repo.findOne({
        where: { appointment: { id: appointment.id }, status: PaymentStatus.PAID },
      });

      if (paid) {
        throw new ConflictException('This appointment is already paid');
      }

      if (appointment.status !== AppointmentStatus.PENDING_PAYMENT) {
        throw new BadRequestException('This appointment is not awaiting payment');
      }

      if (this.holdExpired(appointment)) {
        appointment.status = AppointmentStatus.CANCELLED;
        appointment.holdExpiresAt = null;
        appointment.cancellationReason = 'Payment hold expired';
        await manager.getRepository(Appointment).save(appointment);
        return { expired: true as const };
      }

      const pending = await repo.findOne({
        where: { appointment: { id: appointment.id }, status: PaymentStatus.PENDING },
        relations: { appointment: true },
      });

      if (pending) {
        return { payment: pending };
      }

      const payment = await repo.save(
        repo.create({
          appointment,
          amount: appointment.consultationFee,
          currency: 'BDT',
          status: PaymentStatus.PENDING,
          paymentMethod: dto.paymentMethod,
        }),
      );

      return { payment };
    });

    // Thrown outside the transaction so the CANCELLED update is committed
    if ('expired' in result) {
      throw new BadRequestException(
        'The payment hold for this appointment has expired. Please book another slot.',
      );
    }

    return {
      message: 'Payment initiated. Confirm it to complete the booking.',
      payment: formatPayment(result.payment),
    };
  }

  // Simulated gateway callback. Replace with a real gateway webhook later.
  async confirmPayment(userId: string, paymentId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Payment);

      const locked = await repo
        .createQueryBuilder('payment')
        .where('payment.id = :paymentId', { paymentId })
        .setLock('pessimistic_write')
        .getOne();

      if (!locked) {
        throw new NotFoundException('Payment not found');
      }

      const payment = await repo.findOneOrFail({
        where: { id: paymentId },
        relations: { appointment: { patient: { user: true } } },
      });

      if (payment.appointment.patient.user.id !== userId) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === PaymentStatus.PAID) {
        return { payment, alreadyConfirmed: true };
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new ConflictException('This payment cannot be confirmed');
      }

      const appointment = await this.lockAppointment(manager, payment.appointment.id);

      if (appointment.status !== AppointmentStatus.PENDING_PAYMENT) {
        throw new ConflictException('This appointment cannot receive payment');
      }

      if (this.holdExpired(appointment)) {
        appointment.status = AppointmentStatus.CANCELLED;
        appointment.holdExpiresAt = null;
        appointment.cancellationReason = 'Payment hold expired';
        payment.status = PaymentStatus.FAILED;

        await manager.getRepository(Appointment).save(appointment);
        await repo.save(payment);

        return { expired: true as const };
      }

      payment.status = PaymentStatus.PAID;
      payment.transactionId = `SIM-${randomUUID()}`;
      payment.paidAt = new Date();

      appointment.status = AppointmentStatus.PENDING_DOCTOR;
      appointment.holdExpiresAt = null;

      await repo.save(payment);
      await manager.getRepository(Appointment).save(appointment);

      payment.appointment = appointment;

      return { payment, alreadyConfirmed: false };
    });

    if ('expired' in result) {
      throw new BadRequestException('Payment failed because the appointment hold expired');
    }

    return {
      message: result.alreadyConfirmed
        ? 'Payment was already confirmed'
        : 'Payment confirmed. Waiting for the doctor to accept.',
      payment: formatPayment(result.payment),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: { appointment: { patient: { user: true }, doctor: { user: true } } },
    });

    if (
      !payment ||
      (user.role !== UserRole.ADMIN && payment.appointment.patient.user.id !== user.id)
    ) {
      throw new NotFoundException('Payment not found');
    }

    return formatPayment(payment);
  }

  async findMyPayments(patientUserId: string) {
    const payments = await this.paymentRepository.find({
      where: { appointment: { patient: { user: { id: patientUserId } } } },
      relations: { appointment: { doctor: { user: true } } },
      order: { createdAt: 'DESC' },
    });

    return payments.map(formatPayment);
  }
}
