import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Appointment } from '../appointments/entities/appointment.entity.js';
import { RejectAppointmentDto } from './dto/reject-appointment.dto.js';
import { AppointmentQueryDto } from '../../common/dto/appointment-query.dto.js';

import { AppointmentStatus } from '../../common/enums/appointment-status.enum.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';
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
  constructor(private readonly dataSource: DataSource) {}

  private async lockOwn(manager: EntityManager, id: string, doctorUserId: string) {
    const appointment = await lockAppointment(manager, id);

    if (appointment.doctor.user.id !== doctorUserId) {
      throw new ForbiddenException('You can manage only your own appointments');
    }

    return appointment;
  }

  async findDoctorAppointments(doctorUserId: string, query: AppointmentQueryDto) {
    await expireStaleHolds(this.dataSource.manager);

    const { page, limit } = query;

    const [items, total] = await this.dataSource.getRepository(Appointment).findAndCount({
      where: {
        doctor: { user: { id: doctorUserId } },
        ...(query.status ? { status: query.status } : {}),
      },
      relations: APPOINTMENT_RELATIONS,
      order: { appointmentDate: 'DESC', startTime: 'DESC' },
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

      return formatAppointment(appointment);
    });
  }

  async reject(id: string, doctorUserId: string, dto: RejectAppointmentDto) {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.lockOwn(manager, id, doctorUserId);

      if (appointment.status !== AppointmentStatus.PENDING_DOCTOR) {
        throw new ConflictException('Only paid appointments awaiting approval can be rejected');
      }

      appointment.status = AppointmentStatus.REJECTED;
      appointment.rejectionReason = dto.rejectionReason;

      await manager.getRepository(Appointment).save(appointment);
      await refundPaidPayments(manager, appointment.id);

      return formatAppointment(appointment);
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
