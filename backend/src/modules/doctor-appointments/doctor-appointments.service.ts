import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Appointment } from '../appointments/entities/appointment.entity.js';
import { RejectAppointmentDto } from './dto/reject-appointment.dto.js';
import { AppointmentQueryDto } from '../../common/dto/appointment-query.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';

import { AppointmentStatus, CancelledBy } from '../../common/enums/appointment-status.enum.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';
import { appointmentOrder, appointmentStatusFilter } from '../../common/utils/appointment-filter.util.js';
import {
  APPOINTMENT_RELATIONS,
  expireStaleHolds,
  formatAppointment,
  lockAppointment,
  refundPaidPayments,
} from '../../common/utils/appointment.util.js';

// Doctor side of appointments: own list, accept, reject, complete
@Injectable()
export class DoctorAppointmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  private async lockOwn(manager: EntityManager, id: string, doctorUserId: string) {
    const appointment = await lockAppointment(manager, id);

    if (appointment.doctor.user.id !== doctorUserId) {
      throw new ForbiddenException('You can manage only your own appointments');
    }

    return appointment;
  }

  private when(a: Appointment) {
    return `${a.appointmentDate} at ${a.startTime.slice(0, 5)}`;
  }

  async findDoctorAppointments(doctorUserId: string, query: AppointmentQueryDto) {
    await expireStaleHolds(this.dataSource.manager);

    const { page, limit } = query;

    const [items, total] = await this.dataSource.getRepository(Appointment).findAndCount({
      where: {
        doctor: { user: { id: doctorUserId } },
        ...appointmentStatusFilter(query),
      },
      relations: APPOINTMENT_RELATIONS,
      order: appointmentOrder(query),
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items.map(formatAppointment), total, page, limit);
  }

  async accept(id: string, doctorUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.lockOwn(manager, id, doctorUserId);

      if (appointment.status !== AppointmentStatus.PENDING_DOCTOR) {
        throw new ConflictException('Only paid appointments awaiting approval can be accepted');
      }

      appointment.status = AppointmentStatus.ACCEPTED;
      await manager.getRepository(Appointment).save(appointment);

      await this.notifications.notify(
        {
          userId: appointment.patient.user.id,
          type: NotificationType.APPOINTMENT_ACCEPTED,
          title: 'Appointment accepted',
          message: `${appointment.doctor.user.fullName} accepted your appointment on ${this.when(appointment)}.`,
          relatedEntityType: 'appointment',
          relatedEntityId: appointment.id,
        },
        manager,
      );

      return formatAppointment(appointment);
    });
  }

  // Spec 4E: a rejected appointment becomes CANCELLED, the patient is
  // told why, and their payment is refunded.
  async reject(id: string, doctorUserId: string, dto: RejectAppointmentDto) {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.lockOwn(manager, id, doctorUserId);

      if (
        ![AppointmentStatus.PENDING_DOCTOR, AppointmentStatus.ACCEPTED].includes(appointment.status)
      ) {
        throw new ConflictException('Only upcoming paid appointments can be rejected');
      }

      appointment.status = AppointmentStatus.CANCELLED;
      appointment.cancelledBy = CancelledBy.DOCTOR;
      appointment.rejectionReason = dto.rejectionReason;
      appointment.cancellationReason = dto.rejectionReason;

      await manager.getRepository(Appointment).save(appointment);
      await refundPaidPayments(manager, appointment.id);

      await this.notifications.notify(
        {
          userId: appointment.patient.user.id,
          type: NotificationType.APPOINTMENT_CANCELLED,
          title: 'Appointment declined by the doctor',
          message: `${appointment.doctor.user.fullName} declined your appointment on ${this.when(appointment)}: ${dto.rejectionReason}. Your payment has been refunded.`,
          relatedEntityType: 'appointment',
          relatedEntityId: appointment.id,
        },
        manager,
      );

      return formatAppointment(await lockAppointment(manager, appointment.id));
    });
  }

  async complete(id: string, doctorUserId: string) {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.lockOwn(manager, id, doctorUserId);

      if (appointment.status !== AppointmentStatus.ACCEPTED) {
        throw new ConflictException('Only accepted appointments can be completed');
      }

      appointment.status = AppointmentStatus.COMPLETED;
      await manager.getRepository(Appointment).save(appointment);

      return formatAppointment(appointment);
    });
  }
}
