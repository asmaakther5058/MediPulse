import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';

import { Prescription } from './entities/prescription.entity.js';
import { PrescriptionMedicine } from './entities/prescription-medicine.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';

import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto.js';
import { renderPrescriptionPdf } from './prescription-pdf.js';

import { AppointmentStatus } from '../../common/enums/appointment-status.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';
import { readStored, saveFile } from '../../common/utils/storage.util.js';

const RELATIONS = {
  appointment: true,
  patient: { user: true },
  doctor: { user: true, specialization: true },
  medicines: true,
} as const;

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  private format(p: Prescription) {
    return {
      id: p.id,
      appointmentId: p.appointment?.id,
      appointmentDate: p.appointment?.appointmentDate,
      patient: { id: p.patient.id, patientCode: p.patient.patientCode, name: p.patient.user?.fullName },
      doctor: {
        id: p.doctor.id,
        name: p.doctor.user?.fullName,
        specialization: p.doctor.specialization?.name,
      },
      diagnosis: p.diagnosis,
      advice: p.advice,
      followUpDate: p.followUpDate,
      medicines: (p.medicines ?? []).map((m) => ({
        id: m.id,
        medicineName: m.medicineName,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        instructions: m.instructions,
      })),
      pdfUrl: p.pdfPath ? `/prescriptions/${p.id}/pdf` : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private async load(manager: EntityManager, id: string) {
    const prescription = await manager.getRepository(Prescription).findOne({
      where: { id },
      relations: RELATIONS,
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return prescription;
  }

  // (Re)builds the PDF and stores its path
  private async writePdf(manager: EntityManager, id: string) {
    const prescription = await this.load(manager, id);
    prescription.pdfPath = await saveFile('prescriptions', await renderPrescriptionPdf(prescription), 'pdf');
    await manager.getRepository(Prescription).update(id, { pdfPath: prescription.pdfPath });
    return prescription;
  }

  private canRead(p: Prescription, user: AuthUser) {
    return (
      user.role === UserRole.ADMIN ||
      p.patient.user.id === user.id ||
      p.doctor.user.id === user.id
    );
  }

  // Doctor: prescription for own COMPLETED appointment, saved with its
  // medicines, PDF and patient notification in one transaction
  async create(doctorUserId: string, dto: CreatePrescriptionDto) {
    try {
      const prescription = await this.dataSource.transaction(async (manager) => {
        const appointment = await manager.getRepository(Appointment).findOne({
          where: { id: dto.appointmentId },
          relations: { patient: { user: true }, doctor: { user: true } },
        });

        if (!appointment) {
          throw new NotFoundException('Appointment not found');
        }

        if (appointment.doctor.user.id !== doctorUserId) {
          throw new ForbiddenException('You can only create prescriptions for your own appointments');
        }

        if (appointment.status !== AppointmentStatus.COMPLETED) {
          throw new BadRequestException('Prescription can only be created for completed appointments');
        }

        if (await manager.getRepository(Prescription).exists({ where: { appointment: { id: appointment.id } } })) {
          throw new ConflictException('A prescription already exists for this appointment');
        }

        const saved = await manager.getRepository(Prescription).save(
          manager.getRepository(Prescription).create({
            appointment,
            patient: appointment.patient,
            doctor: appointment.doctor,
            diagnosis: dto.diagnosis,
            advice: dto.advice ?? null,
            followUpDate: dto.followUpDate ?? null,
            medicines: dto.medicines.map((m) => manager.getRepository(PrescriptionMedicine).create({ ...m })),
          }),
        );

        const withPdf = await this.writePdf(manager, saved.id);

        await this.notifications.notify(
          {
            userId: appointment.patient.user.id,
            type: NotificationType.PRESCRIPTION_READY,
            title: 'New prescription',
            message: `${appointment.doctor.user.fullName} has written your prescription. You can view and download it now.`,
            relatedEntityType: 'prescription',
            relatedEntityId: saved.id,
          },
          manager,
        );

        return withPdf;
      });

      return this.format(prescription);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A prescription already exists for this appointment');
      }
      throw error;
    }
  }

  async findOne(id: string, user: AuthUser) {
    const prescription = await this.load(this.dataSource.manager, id);

    // 404, not 403, so other people's prescription ids aren't confirmed
    if (!this.canRead(prescription, user)) {
      throw new NotFoundException('Prescription not found');
    }

    return this.format(prescription);
  }

  // PDF bytes for the owner patient, the doctor or an admin
  async pdf(id: string, user: AuthUser) {
    const prescription = await this.load(this.dataSource.manager, id);

    if (!this.canRead(prescription, user)) {
      throw new NotFoundException('Prescription not found');
    }

    const data = prescription.pdfPath
      ? await readStored(prescription.pdfPath)
      : await renderPrescriptionPdf(prescription);

    return { data, fileName: `prescription-${prescription.patient.patientCode}-${prescription.id.slice(0, 8)}.pdf` };
  }

  private async list(where: Record<string, unknown>, query: PaginationQueryDto) {
    const { page, limit } = query;
    const [items, total] = await this.dataSource.getRepository(Prescription).findAndCount({
      where,
      relations: RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items.map((p) => this.format(p)), total, page, limit);
  }

  findForPatient(patientUserId: string, query: PaginationQueryDto) {
    return this.list({ patient: { user: { id: patientUserId } } }, query);
  }

  findForDoctor(doctorUserId: string, query: PaginationQueryDto) {
    return this.list({ doctor: { user: { id: doctorUserId } } }, query);
  }

  findAll(query: PaginationQueryDto) {
    return this.list({}, query);
  }

  // Doctor (own) or admin. Medicines, if sent, replace the old list.
  // The PDF is regenerated.
  async update(id: string, user: AuthUser, dto: UpdatePrescriptionDto) {
    const prescription = await this.dataSource.transaction(async (manager) => {
      const p = await this.load(manager, id);

      if (user.role !== UserRole.ADMIN && p.doctor.user.id !== user.id) {
        throw new ForbiddenException('You can only update your own prescriptions');
      }

      const fields: Partial<Prescription> = {};
      if (dto.diagnosis !== undefined) fields.diagnosis = dto.diagnosis;
      if (dto.advice !== undefined) fields.advice = dto.advice;
      if (dto.followUpDate !== undefined) fields.followUpDate = dto.followUpDate;

      if (Object.keys(fields).length) {
        await manager.getRepository(Prescription).update(id, fields);
      }

      if (dto.medicines !== undefined) {
        const medicines = manager.getRepository(PrescriptionMedicine);
        await medicines.delete({ id: In(p.medicines.map((m) => m.id)) });
        await medicines.save(
          dto.medicines.map((m) => medicines.create({ ...m, prescription: { id } as Prescription })),
        );
      }

      return this.writePdf(manager, id);
    });

    return this.format(prescription);
  }

  async remove(id: string) {
    const prescription = await this.load(this.dataSource.manager, id);
    await this.dataSource.getRepository(Prescription).remove(prescription);
    return { message: 'Prescription deleted successfully' };
  }
}
