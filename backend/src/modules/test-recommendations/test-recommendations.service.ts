import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TestRecommendation } from './entities/test-recommendation.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { DiagnosticTest } from '../diagnostic-tests/entities/diagnostic-test.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';

import { CreateTestRecommendationDto } from './dto/create-test-recommendation.dto.js';
import { RecommendationQueryDto } from './dto/recommendation-query.dto.js';

import { AppointmentStatus } from '../../common/enums/appointment-status.enum.js';
import { RecommendationStatus } from '../../common/enums/recommendation-status.enum.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';

const RELATIONS = {
  patient: { user: true },
  doctor: { user: true },
  appointment: true,
  diagnosticTest: true,
} as const;

@Injectable()
export class TestRecommendationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  static format(r: TestRecommendation) {
    return {
      id: r.id,
      status: r.status,
      recommendationNote: r.recommendationNote,
      rejectionReason: r.rejectionReason,
      respondedAt: r.respondedAt,
      appointmentId: r.appointment?.id,
      appointmentDate: r.appointment?.appointmentDate,
      patient: r.patient
        ? { id: r.patient.id, patientCode: r.patient.patientCode, name: r.patient.user?.fullName }
        : undefined,
      doctor: r.doctor ? { id: r.doctor.id, name: r.doctor.user?.fullName } : undefined,
      test: r.diagnosticTest
        ? {
            id: r.diagnosticTest.id,
            testName: r.diagnosticTest.testName,
            category: r.diagnosticTest.category,
            description: r.diagnosticTest.description,
            price: r.diagnosticTest.price,
            preparationInstructions: r.diagnosticTest.preparationInstructions,
          }
        : undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  // Doctor recommends one or more tests. One transaction: if any test is
  // missing, inactive or already recommended, nothing is saved.
  async create(doctorUserId: string, dto: CreateTestRecommendationDto) {
    try {
      const ids = await this.dataSource.transaction(async (manager) => {
        const appointment = await manager.getRepository(Appointment).findOne({
          where: { id: dto.appointmentId },
          relations: { patient: { user: true }, doctor: { user: true } },
        });

        if (!appointment) {
          throw new NotFoundException('Appointment not found');
        }

        if (appointment.doctor.user.id !== doctorUserId) {
          throw new ForbiddenException('You can recommend tests only for your own appointments');
        }

        if (appointment.status !== AppointmentStatus.COMPLETED) {
          throw new BadRequestException('Tests can only be recommended for completed appointments');
        }

        const repo = manager.getRepository(TestRecommendation);
        const saved: string[] = [];

        // Saved one by one on purpose: a failure on a later test rolls
        // back the earlier ones (the rollback demo for the report).
        for (const testId of dto.diagnosticTestIds) {
          const test = await manager.getRepository(DiagnosticTest).findOne({
            where: { id: testId, isActive: true },
          });

          if (!test) {
            throw new NotFoundException(`Active diagnostic test ${testId} not found`);
          }

          const row = await repo.save(
            repo.create({
              patient: appointment.patient,
              doctor: appointment.doctor,
              appointment,
              diagnosticTest: test,
              recommendationNote: dto.recommendationNote ?? null,
              status: RecommendationStatus.PENDING,
            }),
          );

          saved.push(row.id);
        }

        const names = (
          await manager.getRepository(DiagnosticTest).findBy(dto.diagnosticTestIds.map((id) => ({ id })))
        ).map((t) => t.testName);

        await this.notifications.notify(
          {
            userId: appointment.patient.user.id,
            type: NotificationType.TEST_RECOMMENDED,
            title: 'Diagnostic test recommended',
            message: `${appointment.doctor.user.fullName} recommended: ${names.join(', ')}. Approve or reject it in Recommended Tests.`,
            relatedEntityType: 'appointment',
            relatedEntityId: appointment.id,
          },
          manager,
        );

        await this.notifications.notifyRole(
          UserRole.DIAGNOSTIC_CENTER,
          {
            type: NotificationType.TEST_RECOMMENDED,
            title: 'New test recommendation',
            message: `${names.join(', ')} recommended for patient ${appointment.patient.patientCode}.`,
            relatedEntityType: 'appointment',
            relatedEntityId: appointment.id,
          },
          manager,
        );

        return saved;
      });

      const rows = await this.dataSource.getRepository(TestRecommendation).find({
        where: ids.map((id) => ({ id })),
        relations: RELATIONS,
      });

      return rows.map(TestRecommendationsService.format);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('One of these tests is already recommended for this appointment');
      }
      throw error;
    }
  }

  // Patient (own), doctor (own), diagnostic center, admin
  async findOne(id: string, user: AuthUser) {
    const r = await this.dataSource.getRepository(TestRecommendation).findOne({
      where: { id },
      relations: RELATIONS,
    });

    const allowed =
      r &&
      (user.role === UserRole.ADMIN ||
        user.role === UserRole.DIAGNOSTIC_CENTER ||
        r.patient.user.id === user.id ||
        r.doctor.user.id === user.id);

    if (!allowed) {
      throw new NotFoundException('Test recommendation not found');
    }

    return TestRecommendationsService.format(r);
  }

  private async list(where: Record<string, unknown>, query: RecommendationQueryDto) {
    const { page, limit } = query;
    const [items, total] = await this.dataSource.getRepository(TestRecommendation).findAndCount({
      where: { ...where, ...(query.status ? { status: query.status } : {}) },
      relations: RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items.map(TestRecommendationsService.format), total, page, limit);
  }

  findForPatient(patientUserId: string, query: RecommendationQueryDto) {
    return this.list({ patient: { user: { id: patientUserId } } }, query);
  }

  findForDoctor(doctorUserId: string, query: RecommendationQueryDto) {
    return this.list({ doctor: { user: { id: doctorUserId } } }, query);
  }

  // Diagnostic center and admin see every recommendation (single center, spec 5C)
  findAll(query: RecommendationQueryDto) {
    return this.list({}, query);
  }
}
