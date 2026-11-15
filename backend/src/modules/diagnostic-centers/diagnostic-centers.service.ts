import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DiagnosticCenter } from './entities/diagnostic-center.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { VerificationStatus } from '../../common/enums/verification-status.enum.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';

import { CreateDiagnosticCenterDto } from './dto/create-diagnostic-center.dto.js';
import { UpdateDiagnosticCenterDto } from './dto/update-diagnostic-center.dto.js';

@Injectable()
export class DiagnosticCentersService {
  constructor(
    @InjectRepository(DiagnosticCenter)
    private readonly centerRepository: Repository<DiagnosticCenter>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

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

    const existingCenter = await this.centerRepository.findOne({
      where: { user: { id: userId } },
    });

    if (existingCenter) {
      throw new ConflictException(
        'Diagnostic center profile already exists',
      );
    }

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
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'License number is already registered',
        );
      }

      throw error;
    }
  }

  async findAll() {
    const centers = await this.centerRepository.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    return centers.map((center) => this.formatCenter(center));
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

    center.verificationStatus = verificationStatus;

    return this.formatCenter(await this.centerRepository.save(center));
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
