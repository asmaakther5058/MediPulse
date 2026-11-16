import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';

import { DiagnosticCenter } from './entities/diagnostic-center.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { VerificationStatus } from '../../common/enums/verification-status.enum.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';
import { DiagnosticTest } from '../diagnostic-tests/entities/diagnostic-test.entity.js';
import { TestRecommendation } from '../test-recommendations/entities/test-recommendation.entity.js';
import { DiagnosticBooking } from '../diagnostic-bookings/entities/diagnostic-booking.entity.js';
import { RecommendationStatus } from '../../common/enums/recommendation-status.enum.js';
import { DiagnosticBookingStatus } from '../../common/enums/diagnostic-booking-status.enum.js';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto.js';

import { CreateDiagnosticCenterDto } from './dto/create-diagnostic-center.dto.js';
import { UpdateDiagnosticCenterDto } from './dto/update-diagnostic-center.dto.js';
import { RegisterDiagnosticCenterDto } from './dto/register-diagnostic-center.dto.js';
import { hashPassword } from '../../common/utils/password.util.js';
import { toSafeUser } from '../../common/utils/safe-user.util.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { MailService } from '../mail/mail.service.js';

// Version 1 has one diagnostic center (spec section 2). A REJECTED application
// does not count, so a new center can apply after a rejection. The database
// index uq_diagnostic_centers_one_active enforces the same rule.
const ONE_CENTER_MESSAGE =
  'A diagnostic center is already registered or waiting for approval; this version supports one center';

@Injectable()
export class DiagnosticCentersService {
  constructor(
    @InjectRepository(DiagnosticCenter)
    private readonly centerRepository: Repository<DiagnosticCenter>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,

    private readonly notifications: NotificationsService,

    private readonly mail: MailService,
  ) {}

  // Throws if another center is PENDING or APPROVED
  private async assertNoOtherActiveCenter(manager: EntityManager, exceptId?: string) {
    const other = await manager.getRepository(DiagnosticCenter).exists({
      where: {
        verificationStatus: Not(VerificationStatus.REJECTED),
        ...(exceptId ? { id: Not(exceptId) } : {}),
      },
    });
    if (other) {
      throw new ConflictException(ONE_CENTER_MESSAGE);
    }
  }

  private isOneCenterViolation(error: unknown) {
    return (
      isUniqueViolation(error) &&
      String((error as { driverError?: { constraint?: string } }).driverError?.constraint) ===
        'uq_diagnostic_centers_one_active'
    );
  }

  // Public sign-up: creates the DIAGNOSTIC_CENTER account and a PENDING
  // center profile together. Nothing works until an admin approves it.
  async register(dto: RegisterDiagnosticCenterDto) {
    const { email, phone, password, ...centerData } = dto;
    const passwordHash = await hashPassword(password);

    try {
      const { user, center } = await this.dataSource.transaction(async (manager) => {
        await this.assertNoOtherActiveCenter(manager);

        const user = await manager.getRepository(User).save(
          manager.getRepository(User).create({
            fullName: centerData.centerName,
            email: email.toLowerCase(),
            phone: phone ?? null,
            passwordHash,
            role: UserRole.DIAGNOSTIC_CENTER,
            isActive: true,
          }),
        );

        const center = await manager.getRepository(DiagnosticCenter).save(
          manager.getRepository(DiagnosticCenter).create({
            ...centerData,
            user,
            verificationStatus: VerificationStatus.PENDING,
          }),
        );

        await this.notifications.notifyRole(
          UserRole.ADMIN,
          {
            type: NotificationType.ACCOUNT_VERIFIED,
            title: 'Diagnostic center waiting for approval',
            message: `${center.centerName} (licence ${center.licenseNumber}) registered and needs verification.`,
            relatedEntityType: 'diagnostic_center',
            relatedEntityId: center.id,
          },
          manager,
        );

        return { user, center };
      });

      this.mail.sendWelcome(user.id);

      center.user = user;
      return {
        message: 'Diagnostic center registered. An admin must approve it before it can be used.',
        user: toSafeUser(user),
        center: this.formatCenter(center),
      };
    } catch (error) {
      if (this.isOneCenterViolation(error)) {
        throw new ConflictException(ONE_CENTER_MESSAGE);
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email, phone or licence number is already registered');
      }
      throw error;
    }
  }

  private formatCenter(center: DiagnosticCenter) {
    return {
      id: center.id,
      userId: center.user.id,
      name: center.user.fullName,
      email: center.user.email,
      phone: center.user.phone,
      centerName: center.centerName,
      licenseNumber: center.licenseNumber,
      address: center.address,
      city: center.city,
      area: center.area,
      contactNumber: center.contactNumber,
      description: center.description,
      verificationStatus: center.verificationStatus,
      createdAt: center.createdAt,
      updatedAt: center.updatedAt,
    };
  }

  private async getCenterOrFail(id: string) {
    const center = await this.centerRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!center) {
      throw new NotFoundException(
        `Diagnostic Center with ID ${id} not found`,
      );
    }

    return center;
  }

  private checkOwnership(
    center: DiagnosticCenter,
    requesterId: string,
    requesterRole: UserRole,
  ) {
    if (
      requesterRole !== UserRole.ADMIN &&
      center.user.id !== requesterId
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this diagnostic center',
      );
    }
  }

  async create(
    userId: string,
    createDto: CreateDiagnosticCenterDto,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.DIAGNOSTIC_CENTER) {
      throw new BadRequestException(
        'User must have the DIAGNOSTIC_CENTER role',
      );
    }

    if (await this.centerRepository.exists({ where: { user: { id: user.id } } })) {
      throw new ConflictException('This user already has a diagnostic center profile');
    }

    await this.assertNoOtherActiveCenter(this.dataSource.manager);

    const center = this.centerRepository.create({
      ...createDto,
      user,
      verificationStatus: VerificationStatus.PENDING,
    });

    try {
      const savedCenter = await this.centerRepository.save(center);

      savedCenter.user = user;
      return this.formatCenter(savedCenter);
    } catch (error) {
      if (this.isOneCenterViolation(error)) {
        throw new ConflictException(ONE_CENTER_MESSAGE);
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'License number is already registered',
        );
      }

      throw error;
    }
  }

  async findAll(query: PaginationQueryDto) {
    const { page, limit } = query;
    const [centers, total] = await this.centerRepository.findAndCount({
      relations: { user: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(centers.map((center) => this.formatCenter(center)), total, page, limit);
  }

  // Center overview (spec 5A)
  async dashboard() {
    const count = <T extends object>(entity: new () => T, where: Record<string, unknown> = {}) =>
      this.dataSource.getRepository(entity).count({ where: where as never });

    const [activeTests, recommended, pendingRecommendations, confirmed, completed, recent] = await Promise.all([
      count(DiagnosticTest, { isActive: true }),
      count(TestRecommendation),
      count(TestRecommendation, { status: RecommendationStatus.PENDING }),
      count(DiagnosticBooking, { status: DiagnosticBookingStatus.CONFIRMED }),
      count(DiagnosticBooking, { status: DiagnosticBookingStatus.COMPLETED }),
      this.dataSource.getRepository(DiagnosticBooking).find({
        where: { status: DiagnosticBookingStatus.CONFIRMED },
        relations: { patient: { user: true }, recommendation: { diagnosticTest: true } },
        order: { bookingDate: 'ASC' },
        take: 5,
      }),
    ]);

    return {
      availableTests: activeTests,
      totalRecommendedTests: recommended,
      recommendationsAwaitingPatient: pendingRecommendations,
      confirmedBookings: confirmed,
      completedTests: completed,
      upcomingBookings: recent.map((b) => ({
        id: b.id,
        patientCode: b.patient.patientCode,
        patientName: b.patient.user.fullName,
        testName: b.recommendation.diagnosticTest.testName,
        bookingDate: b.bookingDate,
        bookingTime: b.bookingTime,
      })),
    };
  }

  async findOne(
    id: string,
    requesterId: string,
    requesterRole: UserRole,
  ) {
    const center = await this.getCenterOrFail(id);

    this.checkOwnership(center, requesterId, requesterRole);

    return this.formatCenter(center);
  }

  async getMyProfile(userId: string) {
    const center = await this.centerRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!center) {
      throw new NotFoundException(
        'Diagnostic center profile not found',
      );
    }

    return this.formatCenter(center);
  }

  async update(
    id: string,
    updateDto: UpdateDiagnosticCenterDto,
    requesterId: string,
    requesterRole: UserRole,
  ) {
    const center = await this.getCenterOrFail(id);

    this.checkOwnership(center, requesterId, requesterRole);

    // A center editing its own license must be re-verified
    if (
      requesterRole !== UserRole.ADMIN &&
      updateDto.licenseNumber !== undefined &&
      updateDto.licenseNumber !== center.licenseNumber
    ) {
      center.verificationStatus = VerificationStatus.PENDING;
    }

    Object.assign(center, updateDto);

    try {
      const updatedCenter = await this.centerRepository.save(center);

      return this.formatCenter(updatedCenter);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'License number is already registered',
        );
      }

      throw error;
    }
  }

  async updateVerification(id: string, verificationStatus: VerificationStatus) {
    const center = await this.getCenterOrFail(id);

    // Approving (or reopening) a center while another one is active would
    // give the platform two centers
    if (verificationStatus !== VerificationStatus.REJECTED) {
      await this.assertNoOtherActiveCenter(this.dataSource.manager, center.id);
    }

    center.verificationStatus = verificationStatus;

    let saved: DiagnosticCenter;
    try {
      saved = await this.centerRepository.save(center);
    } catch (error) {
      if (this.isOneCenterViolation(error)) {
        throw new ConflictException(ONE_CENTER_MESSAGE);
      }
      throw error;
    }

    if (verificationStatus !== VerificationStatus.PENDING && center.user) {
      await this.notifications.notify({
        userId: center.user.id,
        type: NotificationType.ACCOUNT_VERIFIED,
        title: `Diagnostic center ${verificationStatus.toLowerCase()}`,
        message:
          verificationStatus === VerificationStatus.APPROVED
            ? 'Your diagnostic center is approved. You can now add tests and receive bookings.'
            : 'Your diagnostic center was not approved. Contact the admin for details.',
        relatedEntityType: 'diagnostic_center',
        relatedEntityId: center.id,
      });
    }

    return this.formatCenter(saved);
  }

  // Patient-facing: approved, active centers (no owner contact details)
  async findApproved(city?: string) {
    const centers = await this.centerRepository.find({
      where: {
        verificationStatus: VerificationStatus.APPROVED,
        user: { isActive: true },
        ...(city ? { city } : {}),
      },
      order: { centerName: 'ASC' },
    });

    return centers.map((c) => ({
      id: c.id,
      centerName: c.centerName,
      address: c.address,
      city: c.city,
      area: c.area,
      contactNumber: c.contactNumber,
      description: c.description,
    }));
  }
}
