import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Not } from 'typeorm';

import { Appointment } from './entities/appointment.entity.js';
import { Patient } from '../patients/entities/patient.entity.js';
import { Doctor } from '../doctors/entities/doctor.entity.js';
import { DoctorAvailability } from '../doctor-availability/entities/doctor-availability.entity.js';

import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import { AppointmentQueryDto } from '../../common/dto/appointment-query.dto.js';

import {
  AppointmentStatus,
  CancelledBy,
  PAYMENT_HOLD_MINUTES,
} from '../../common/enums/appointment-status.enum.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { appointmentOrder, appointmentStatusFilter } from '../../common/utils/appointment-filter.util.js';
import { VerificationStatus } from '../../common/enums/verification-status.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';
import {
  APPOINTMENT_RELATIONS,
  expireStaleHolds,
  formatAppointment,
  lockAppointment,
  refundPaidPayments,
} from '../../common/utils/appointment.util.js';
import {
  slotStartInstant,
  todayInAppZone,
  weekdayOf,
} from '../../common/utils/date.util.js';

// Patient side of appointments: book, view, cancel.
// Doctor actions (accept/reject/complete) live in doctor-appointments.
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateAppointmentDto) {
    const weekday = weekdayOf(dto.appointmentDate);

    if (dto.appointmentDate < todayInAppZone()) {
      throw new BadRequestException('Appointment date cannot be in the past');
    }

    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const patient = await manager.getRepository(Patient).findOne({
          where: { user: { id: userId } },
        });

        if (!patient) {
          throw new NotFoundException('Patient profile not found');
        }

        // Serialise bookings for this slot
        const lockedSlot = await manager
          .getRepository(DoctorAvailability)
          .createQueryBuilder('slot')
          .where('slot.id = :id', { id: dto.availabilityId })
          .setLock('pessimistic_write')
          .getOne();

        if (!lockedSlot) {
          throw new NotFoundException('Availability slot not found');
        }

        const slot = await manager.getRepository(DoctorAvailability).findOneOrFail({
          where: { id: lockedSlot.id },
          relations: { doctor: { user: true } },
        });

        const doctor: Doctor = slot.doctor;

        if (
          doctor.verificationStatus !== VerificationStatus.APPROVED ||
          !doctor.user.isActive
        ) {
          throw new BadRequestException('This doctor is not currently available for booking');
        }

        if (!slot.isAvailable) {
          throw new BadRequestException('This slot is not available');
        }

        if (slot.dayOfWeek !== weekday) {
          throw new BadRequestException(
            `This slot is on ${slot.dayOfWeek}, but ${dto.appointmentDate} is a ${weekday}`,
          );
        }

        if (slotStartInstant(dto.appointmentDate, slot.startTime) <= new Date()) {
          throw new BadRequestException('You cannot book a past time slot');
        }

        await expireStaleHolds(manager);

        const taken = await manager.getRepository(Appointment).findOne({
          where: {
            availability: { id: slot.id },
            appointmentDate: dto.appointmentDate,
            status: Not(AppointmentStatus.CANCELLED),
          },
        });

        if (taken) {
          throw new ConflictException('This time slot has already been booked');
        }

        const saved = await manager.getRepository(Appointment).save(
          manager.getRepository(Appointment).create({
            patient,
            doctor,
            availability: slot,
            appointmentDate: dto.appointmentDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            consultationFee: doctor.consultationFee,
            status: AppointmentStatus.PENDING_PAYMENT,
            holdExpiresAt: new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60 * 1000),
            patientNote: dto.patientNote ?? null,
          }),
        );

        return saved.id;
      });

      const appointment = await this.dataSource.getRepository(Appointment).findOneOrFail({
        where: { id },
        relations: APPOINTMENT_RELATIONS,
      });

      return {
        message: `Slot reserved. Complete payment within ${PAYMENT_HOLD_MINUTES} minutes to confirm.`,
        appointment: formatAppointment(appointment),
      };
    } catch (error) {
      // Partial unique index uq_appointment_active_slot is the final guard
      if (isUniqueViolation(error)) {
        throw new ConflictException('This time slot has already been booked');
      }
      throw error;
    }
  }

  async findMyAppointments(userId: string, query: AppointmentQueryDto) {
    return this.list(query, { patient: { user: { id: userId } } });
  }

  async findAll(query: AppointmentQueryDto) {
    return this.list(query, {});
  }

  private async list(query: AppointmentQueryDto, where: Record<string, unknown>) {
    await expireStaleHolds(this.dataSource.manager);

    const { page, limit } = query;

    const [items, total] = await this.dataSource.getRepository(Appointment).findAndCount({
      where: { ...where, ...appointmentStatusFilter(query) },
      relations: APPOINTMENT_RELATIONS,
      order: appointmentOrder(query),
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items.map(formatAppointment), total, page, limit);
  }

  // Patient or doctor of this appointment, or admin
  async findOne(id: string, user: AuthUser) {
    await expireStaleHolds(this.dataSource.manager);

    const appointment = await this.dataSource.getRepository(Appointment).findOne({
      where: { id },
      relations: APPOINTMENT_RELATIONS,
    });

    const allowed =
      appointment &&
      (user.role === UserRole.ADMIN ||
        appointment.patient.user.id === user.id ||
        appointment.doctor.user.id === user.id);

    // 404 (not 403) so ids of other people's appointments aren't confirmed
    if (!allowed) {
      throw new NotFoundException('Appointment not found');
    }

    return formatAppointment(appointment);
  }

  async cancel(id: string, userId: string, dto: CancelAppointmentDto) {
    await expireStaleHolds(this.dataSource.manager);

    return this.dataSource.transaction(async (manager) => {
      const appointment = await lockAppointment(manager, id);

      if (appointment.patient.user.id !== userId) {
        throw new NotFoundException('Appointment not found');
      }

      const cancellable = [
        AppointmentStatus.PENDING_PAYMENT,
        AppointmentStatus.PENDING_DOCTOR,
        AppointmentStatus.ACCEPTED,
      ];

      if (!cancellable.includes(appointment.status)) {
        throw new ConflictException('This appointment cannot be cancelled');
      }

      const wasPaid = appointment.status !== AppointmentStatus.PENDING_PAYMENT;

      appointment.status = AppointmentStatus.CANCELLED;
      appointment.holdExpiresAt = null;
      appointment.cancelledBy = CancelledBy.PATIENT;
      appointment.cancellationReason = dto.cancellationReason ?? null;

      await manager.getRepository(Appointment).save(appointment);
      await refundPaidPayments(manager, appointment.id);

      if (wasPaid) {
        await this.notifications.notify(
          {
            userId: appointment.doctor.user.id,
            type: NotificationType.APPOINTMENT_CANCELLED,
            title: 'Appointment cancelled by the patient',
            message: `${appointment.patient.user.fullName} (${appointment.patient.patientCode}) cancelled the appointment on ${appointment.appointmentDate} at ${appointment.startTime.slice(0, 5)}.`,
            relatedEntityType: 'appointment',
            relatedEntityId: appointment.id,
          },
          manager,
        );
      }

      return formatAppointment(await lockAppointment(manager, appointment.id));
    });
  }
}
