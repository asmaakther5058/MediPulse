import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { DiagnosticBooking } from './entities/diagnostic-booking.entity.js';
import { TestRecommendation } from '../test-recommendations/entities/test-recommendation.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';

import { CreateDiagnosticBookingDto } from './dto/create-diagnostic-booking.dto.js';
import { RejectRecommendationDto } from './dto/reject-recommendation.dto.js';
import { CancelDiagnosticBookingDto } from './dto/cancel-diagnostic-booking.dto.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';

import { DiagnosticBookingStatus } from '../../common/enums/diagnostic-booking-status.enum.js';
import { RecommendationStatus } from '../../common/enums/recommendation-status.enum.js';
import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';
import { getTheDiagnosticCenter } from '../../common/utils/center.util.js';
import { todayInAppZone, weekdayOf } from '../../common/utils/date.util.js';

const RELATIONS = {
  patient: { user: true },
  diagnosticCenter: true,
  recommendation: { diagnosticTest: true, doctor: { user: true } },
} as const;

// Patient side of diagnostic tests (spec 3G, 3H, workflow 5):
// approve or reject a recommendation, pay, cancel; plus the center's
// list of confirmed bookings (spec 5D).
@Injectable()
export class DiagnosticBookingsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  private format(b: DiagnosticBooking, payments: Payment[] = []) {
    const paid = payments.find((p) => p.status === PaymentStatus.PAID);
    const refunded = payments.find((p) => p.status === PaymentStatus.REFUNDED);
    const pending = payments.find((p) => p.status === PaymentStatus.PENDING);

    return {
      id: b.id,
      status: b.status,
      bookingDate: b.bookingDate,
      bookingTime: b.bookingTime,
      price: b.price,
      currency: 'BDT',
      paymentStatus: (paid ?? refunded ?? pending)?.status ?? null,
      patientNote: b.patientNote,
      centerNote: b.centerNote,
      cancellationReason: b.cancellationReason,
      completedAt: b.completedAt,
      patient: b.patient
        ? { id: b.patient.id, patientCode: b.patient.patientCode, name: b.patient.user?.fullName, phone: b.patient.user?.phone }
        : undefined,
      test: b.recommendation?.diagnosticTest
        ? {
            id: b.recommendation.diagnosticTest.id,
            testName: b.recommendation.diagnosticTest.testName,
            preparationInstructions: b.recommendation.diagnosticTest.preparationInstructions,
          }
        : undefined,
      recommendationId: b.recommendation?.id,
      recommendedBy: b.recommendation?.doctor?.user?.fullName,
      diagnosticCenter: b.diagnosticCenter
        ? { id: b.diagnosticCenter.id, centerName: b.diagnosticCenter.centerName, address: b.diagnosticCenter.address }
        : undefined,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  private async withPayments(manager: EntityManager, bookings: DiagnosticBooking[]) {
    if (!bookings.length) return [];

    const payments = await manager.getRepository(Payment).find({
      where: bookings.map((b) => ({ diagnosticBooking: { id: b.id } })),
      relations: { diagnosticBooking: true },
    });

    return bookings.map((b) => this.format(b, payments.filter((p) => p.diagnosticBooking?.id === b.id)));
  }

  private async lockOwnRecommendation(manager: EntityManager, id: string, patientUserId: string) {
    const locked = await manager
      .getRepository(TestRecommendation)
      .createQueryBuilder('r')
      .where('r.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();

    const rec = locked
      ? await manager.getRepository(TestRecommendation).findOne({
          where: { id },
          relations: { patient: { user: true }, doctor: { user: true }, diagnosticTest: true },
        })
      : null;

    if (!rec || rec.patient.user.id !== patientUserId) {
      throw new NotFoundException('Test recommendation not found');
    }

    if (rec.status !== RecommendationStatus.PENDING) {
      throw new ConflictException(`This recommendation is already ${rec.status}`);
    }

    return rec;
  }

  // Green button: approve -> booking at the test price, waiting for payment
  async approve(recommendationId: string, patientUserId: string, dto: CreateDiagnosticBookingDto) {
    weekdayOf(dto.bookingDate);

    if (dto.bookingDate < todayInAppZone()) {
      throw new BadRequestException('Booking date cannot be in the past');
    }

    try {
      const bookingId = await this.dataSource.transaction(async (manager) => {
        const rec = await this.lockOwnRecommendation(manager, recommendationId, patientUserId);

        if (!rec.diagnosticTest.isActive) {
          throw new ConflictException('This test is no longer offered');
        }

        const center = await getTheDiagnosticCenter(manager);

        const booking = await manager.getRepository(DiagnosticBooking).save(
          manager.getRepository(DiagnosticBooking).create({
            patient: rec.patient,
            recommendation: rec,
            diagnosticCenter: center,
            bookingDate: dto.bookingDate,
            bookingTime: dto.bookingTime ?? null,
            patientNote: dto.patientNote ?? null,
            price: rec.diagnosticTest.price,
            status: DiagnosticBookingStatus.PENDING_PAYMENT,
          }),
        );

        rec.status = RecommendationStatus.APPROVED;
        rec.respondedAt = new Date();
        await manager.getRepository(TestRecommendation).save(rec);

        await this.notifications.notify({
          userId: rec.doctor.user.id,
          type: NotificationType.TEST_RECOMMENDATION_ANSWERED,
          title: 'Test approved by patient',
          message: `${rec.patient.user.fullName} (${rec.patient.patientCode}) approved ${rec.diagnosticTest.testName}.`,
          relatedEntityType: 'test_recommendation',
          relatedEntityId: rec.id,
        }, manager);

        return booking.id;
      });

      const [booking] = await this.withPayments(this.dataSource.manager, [
        await this.dataSource.getRepository(DiagnosticBooking).findOneOrFail({ where: { id: bookingId }, relations: RELATIONS }),
      ]);

      return {
        message: `Test approved. Pay ${booking.price} BDT to confirm the booking (POST /payments/diagnostic).`,
        booking,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This recommendation already has a booking');
      }
      throw error;
    }
  }

  // Red button: reject -> no booking, no payment (business rule 12)
  async reject(recommendationId: string, patientUserId: string, dto: RejectRecommendationDto) {
    return this.dataSource.transaction(async (manager) => {
      const rec = await this.lockOwnRecommendation(manager, recommendationId, patientUserId);

      rec.status = RecommendationStatus.REJECTED;
      rec.respondedAt = new Date();
      rec.rejectionReason = dto.reason ?? null;
      await manager.getRepository(TestRecommendation).save(rec);

      await this.notifications.notify({
        userId: rec.doctor.user.id,
        type: NotificationType.TEST_RECOMMENDATION_ANSWERED,
        title: 'Test declined by patient',
        message: `${rec.patient.user.fullName} (${rec.patient.patientCode}) declined ${rec.diagnosticTest.testName}${dto.reason ? `: ${dto.reason}` : '.'}`,
        relatedEntityType: 'test_recommendation',
        relatedEntityId: rec.id,
      }, manager);

      return { id: rec.id, status: rec.status, rejectionReason: rec.rejectionReason, respondedAt: rec.respondedAt };
    });
  }

  private async list(where: Record<string, unknown>, query: BookingQueryDto) {
    const { page, limit } = query;
    const [items, total] = await this.dataSource.getRepository(DiagnosticBooking).findAndCount({
      where: { ...where, ...(query.status ? { status: query.status } : {}) },
      relations: RELATIONS,
      order: { bookingDate: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(await this.withPayments(this.dataSource.manager, items), total, page, limit);
  }

  findForPatient(patientUserId: string, query: BookingQueryDto) {
    return this.list({ patient: { user: { id: patientUserId } } }, query);
  }

  // Center: confirmed (paid) bookings by default (spec 5D)
  findForCenter(query: BookingQueryDto) {
    return this.list(query.status ? {} : { status: DiagnosticBookingStatus.CONFIRMED }, query);
  }

  findAll(query: BookingQueryDto) {
    return this.list({}, query);
  }

  async findOne(id: string, user: AuthUser) {
    const booking = await this.dataSource.getRepository(DiagnosticBooking).findOne({ where: { id }, relations: RELATIONS });

    const allowed =
      booking &&
      (user.role === UserRole.ADMIN ||
        user.role === UserRole.DIAGNOSTIC_CENTER ||
        booking.patient.user.id === user.id);

    if (!allowed) {
      throw new NotFoundException('Diagnostic booking not found');
    }

    return (await this.withPayments(this.dataSource.manager, [booking]))[0];
  }

  // Patient cancels before the test is done. Paid -> refunded; the
  // recommendation goes back to PENDING so it can be approved again.
  async cancelByPatient(id: string, patientUserId: string, dto: CancelDiagnosticBookingDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const locked = await manager
        .getRepository(DiagnosticBooking)
        .createQueryBuilder('b')
        .where('b.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();

      const booking = locked
        ? await manager.getRepository(DiagnosticBooking).findOne({ where: { id }, relations: RELATIONS })
        : null;

      if (!booking || booking.patient.user.id !== patientUserId) {
        throw new NotFoundException('Diagnostic booking not found');
      }

      if (![DiagnosticBookingStatus.PENDING_PAYMENT, DiagnosticBookingStatus.CONFIRMED].includes(booking.status)) {
        throw new ConflictException('This booking cannot be cancelled');
      }

      const wasConfirmed = booking.status === DiagnosticBookingStatus.CONFIRMED;

      booking.status = DiagnosticBookingStatus.CANCELLED;
      booking.cancellationReason = dto.cancellationReason ?? null;
      await manager.getRepository(DiagnosticBooking).save(booking);

      await manager.getRepository(Payment).update(
        { diagnosticBooking: { id }, status: PaymentStatus.PAID },
        { status: PaymentStatus.REFUNDED },
      );
      await manager.getRepository(Payment).update(
        { diagnosticBooking: { id }, status: PaymentStatus.PENDING },
        { status: PaymentStatus.FAILED },
      );

      await manager.getRepository(TestRecommendation).update(booking.recommendation.id, {
        status: RecommendationStatus.PENDING,
        respondedAt: null,
      });

      if (wasConfirmed) {
        await this.notifications.notifyRole(UserRole.DIAGNOSTIC_CENTER, {
          type: NotificationType.TEST_BOOKING_CONFIRMED,
          title: 'Test booking cancelled',
          message: `${booking.recommendation.diagnosticTest.testName} for patient ${booking.patient.patientCode} on ${booking.bookingDate} was cancelled.`,
          relatedEntityType: 'diagnostic_booking',
          relatedEntityId: booking.id,
        }, manager);
      }

      return booking.id;
    });

    return this.findOne(result, { id: patientUserId, role: UserRole.PATIENT } as AuthUser);
  }
}
