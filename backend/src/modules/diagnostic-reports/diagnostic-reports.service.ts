import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { unlink } from 'node:fs/promises';

import { DiagnosticReport } from './entities/diagnostic-report.entity.js';
import { DiagnosticBooking } from '../diagnostic-bookings/entities/diagnostic-booking.entity.js';
import { TestRecommendation } from '../test-recommendations/entities/test-recommendation.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { User } from '../users/entities/user.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';

import { CompleteTestDto } from './dto/complete-test.dto.js';
import { UpdateReportDto } from './dto/update-report.dto.js';

import { DiagnosticBookingStatus } from '../../common/enums/diagnostic-booking-status.enum.js';
import { RecommendationStatus } from '../../common/enums/recommendation-status.enum.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';
import {
  REPORT_MAX_BYTES,
  REPORT_TYPES,
  detectReportType,
  readStored,
  resolveStored,
  saveFile,
} from '../../common/utils/storage.util.js';

export interface UploadedReportFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

const RELATIONS = {
  booking: {
    patient: { user: true },
    recommendation: { diagnosticTest: true, doctor: { user: true } },
    diagnosticCenter: true,
  },
  uploadedBy: true,
} as const;

@Injectable()
export class DiagnosticReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  private format(r: DiagnosticReport) {
    const b = r.booking;
    return {
      id: r.id,
      bookingId: b?.id,
      bookingDate: b?.bookingDate,
      completedAt: b?.completedAt,
      patient: b?.patient
        ? { id: b.patient.id, patientCode: b.patient.patientCode, name: b.patient.user?.fullName }
        : undefined,
      test: b?.recommendation?.diagnosticTest
        ? { id: b.recommendation.diagnosticTest.id, testName: b.recommendation.diagnosticTest.testName }
        : undefined,
      recommendedBy: b?.recommendation?.doctor?.user?.fullName,
      centerName: b?.diagnosticCenter?.centerName,
      findings: r.findings,
      hasFile: !!r.filePath,
      fileName: r.fileName,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      downloadUrl: r.filePath ? `/diagnostic-reports/${r.id}/download` : null,
      uploadedBy: r.uploadedBy?.fullName,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  // Validates the upload by its content and stores it; returns DB fields
  private async storeFile(file?: UploadedReportFile) {
    if (!file) return null;

    if (file.size > REPORT_MAX_BYTES) {
      throw new BadRequestException('Report file must be 5 MB or smaller');
    }

    const mimeType = detectReportType(file.buffer);

    if (!mimeType) {
      throw new BadRequestException('Report file must be a PDF, PNG or JPEG');
    }

    const filePath = await saveFile('reports', file.buffer, REPORT_TYPES[mimeType]);
    const fileName = file.originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 200) || `report.${REPORT_TYPES[mimeType]}`;

    return { filePath, fileName, mimeType, fileSize: file.size };
  }

  private async discard(path?: string | null) {
    if (path) await unlink(resolveStored(path)).catch(() => undefined);
  }

  // Spec 5E "Complete Test": booking -> COMPLETED, report saved,
  // recommendation -> COMPLETED, patient and doctor notified. One transaction.
  async completeTest(bookingId: string, user: AuthUser, dto: CompleteTestDto, file?: UploadedReportFile) {
    const findings = dto.findings?.trim() || null;

    if (!findings && !file) {
      throw new BadRequestException('Send the findings, a report file, or both');
    }

    const stored = await this.storeFile(file);

    try {
      const reportId = await this.dataSource.transaction(async (manager) => {
        const locked = await manager
          .getRepository(DiagnosticBooking)
          .createQueryBuilder('b')
          .where('b.id = :id', { id: bookingId })
          .setLock('pessimistic_write')
          .getOne();

        if (!locked) {
          throw new NotFoundException('Diagnostic booking not found');
        }

        const booking = await manager.getRepository(DiagnosticBooking).findOneOrFail({
          where: { id: bookingId },
          relations: { patient: { user: true }, recommendation: { diagnosticTest: true, doctor: { user: true } } },
        });

        if (booking.status !== DiagnosticBookingStatus.CONFIRMED) {
          throw new ConflictException('Only confirmed (paid) bookings can be completed');
        }

        booking.status = DiagnosticBookingStatus.COMPLETED;
        booking.completedAt = new Date();
        if (dto.centerNote !== undefined) booking.centerNote = dto.centerNote;
        await manager.getRepository(DiagnosticBooking).save(booking);

        await manager
          .getRepository(TestRecommendation)
          .update(booking.recommendation.id, { status: RecommendationStatus.COMPLETED });

        const report = await manager.getRepository(DiagnosticReport).save(
          manager.getRepository(DiagnosticReport).create({
            booking,
            uploadedBy: { id: user.id } as User,
            findings,
            ...stored,
          }),
        );

        const testName = booking.recommendation.diagnosticTest.testName;

        await this.notifications.notify(
          {
            userId: booking.patient.user.id,
            type: NotificationType.REPORT_READY,
            title: 'Your test report is ready',
            message: `Your ${testName} report is available to view and download.`,
            relatedEntityType: 'diagnostic_report',
            relatedEntityId: report.id,
          },
          manager,
        );

        await this.notifications.notify(
          {
            userId: booking.recommendation.doctor.user.id,
            type: NotificationType.REPORT_READY,
            title: 'Test report ready',
            message: `${testName} report for patient ${booking.patient.patientCode} is ready.`,
            relatedEntityType: 'diagnostic_report',
            relatedEntityId: report.id,
          },
          manager,
        );

        return report.id;
      });

      return this.format(await this.load(this.dataSource.manager, reportId));
    } catch (error) {
      await this.discard(stored?.filePath);

      if (isUniqueViolation(error)) {
        throw new ConflictException('This booking already has a report');
      }
      throw error;
    }
  }

  private async load(manager: EntityManager, id: string) {
    const report = await manager.getRepository(DiagnosticReport).findOne({ where: { id }, relations: RELATIONS });

    if (!report) {
      throw new NotFoundException('Diagnostic report not found');
    }

    return report;
  }

  // Patient (own), center, admin, and the recommending doctor or any doctor
  // with a paid appointment with this patient
  private async canRead(r: DiagnosticReport, user: AuthUser) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.DIAGNOSTIC_CENTER) return true;
    if (user.role === UserRole.PATIENT) return r.booking.patient.user.id === user.id;

    if (user.role === UserRole.DOCTOR) {
      if (r.booking.recommendation.doctor.user.id === user.id) return true;

      return this.dataSource.getRepository(Appointment).exists({
        where: {
          patient: { id: r.booking.patient.id },
          doctor: { user: { id: user.id } },
          status: In([AppointmentStatus.PENDING_DOCTOR, AppointmentStatus.ACCEPTED, AppointmentStatus.COMPLETED]),
        },
      });
    }

    return false;
  }

  async findOne(id: string, user: AuthUser) {
    const report = await this.load(this.dataSource.manager, id);

    if (!(await this.canRead(report, user))) {
      throw new NotFoundException('Diagnostic report not found');
    }

    return this.format(report);
  }

  async download(id: string, user: AuthUser) {
    const report = await this.load(this.dataSource.manager, id);

    if (!(await this.canRead(report, user))) {
      throw new NotFoundException('Diagnostic report not found');
    }

    if (!report.filePath) {
      throw new NotFoundException('This report has no file; see its findings');
    }

    return {
      data: await readStored(report.filePath),
      mimeType: report.mimeType ?? 'application/octet-stream',
      fileName: report.fileName ?? `report-${report.id.slice(0, 8)}`,
    };
  }

  private async list(where: Record<string, unknown>, query: PaginationQueryDto) {
    const { page, limit } = query;
    const [items, total] = await this.dataSource.getRepository(DiagnosticReport).findAndCount({
      where,
      relations: RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items.map((r) => this.format(r)), total, page, limit);
  }

  findMine(patientUserId: string, query: PaginationQueryDto) {
    return this.list({ booking: { patient: { user: { id: patientUserId } } } }, query);
  }

  findAll(query: PaginationQueryDto) {
    return this.list({}, query);
  }

  // Center: correct findings or replace the file
  async update(id: string, dto: UpdateReportDto, file?: UploadedReportFile) {
    if (dto.findings === undefined && !file) {
      throw new BadRequestException('Send new findings, a new file, or both');
    }

    const report = await this.load(this.dataSource.manager, id);
    const stored = await this.storeFile(file);
    const oldPath = report.filePath;

    if (dto.findings !== undefined) report.findings = dto.findings.trim() || null;
    if (stored) Object.assign(report, stored);

    if (!report.findings && !report.filePath) {
      await this.discard(stored?.filePath);
      throw new BadRequestException('A report needs findings or a file');
    }

    await this.dataSource.getRepository(DiagnosticReport).save(report);
    if (stored) await this.discard(oldPath);

    return this.format(await this.load(this.dataSource.manager, id));
  }
}
