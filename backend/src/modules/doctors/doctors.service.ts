import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Doctor } from './entities/doctor.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Specialization } from '../specializations/entities/specialization.entity.js';

import { CreateDoctorDto } from './dto/create-doctor.dto.js';
import { UpdateDoctorDto } from './dto/update-doctor.dto.js';
import { RegisterDoctorDto } from './dto/register-doctor.dto.js';
import { VerifyDoctorDto } from './dto/verify-doctor.dto.js';
import { DoctorQueryDto } from './dto/doctor-query.dto.js';

import { UserRole } from '../../common/enums/user-role.enum.js';
import { VerificationStatus } from '../../common/enums/verification-status.enum.js';
import { hashPassword } from '../../common/utils/password.util.js';
import { isUniqueViolation, toSafeUser } from '../../common/utils/safe-user.util.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Specialization)
    private readonly specializationRepository: Repository<Specialization>,

    private readonly dataSource: DataSource,
  ) {}

  // Safe response shape (no password hash)
  private format(doctor: Doctor) {
    return {
      id: doctor.id,
      user: doctor.user
        ? {
            id: doctor.user.id,
            fullName: doctor.user.fullName,
            email: doctor.user.email,
            phone: doctor.user.phone,
            profileImageUrl: doctor.user.profileImageUrl,
          }
        : undefined,
      specialization: doctor.specialization
        ? { id: doctor.specialization.id, name: doctor.specialization.name }
        : undefined,
      qualifications: doctor.qualifications,
      experienceYears: doctor.experienceYears,
      consultationFee: doctor.consultationFee,
      professionalInfo: doctor.professionalInfo,
      verificationStatus: doctor.verificationStatus,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    };
  }

  private async getActiveSpecialization(id: string) {
    const specialization = await this.specializationRepository.findOne({
      where: { id, isActive: true },
    });

    if (!specialization) {
      throw new NotFoundException('Active specialization not found');
    }

    return specialization;
  }

  private async findRecord(id: string) {
    const doctor = await this.doctorRepository.findOne({
      where: { id },
      relations: { user: true, specialization: true },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    return doctor;
  }

  // Public doctor sign-up
  async register(dto: RegisterDoctorDto) {
    const specialization = await this.getActiveSpecialization(dto.specializationId);
    const passwordHash = await hashPassword(dto.password);

    try {
      const { user, doctor } = await this.dataSource.transaction(async (manager) => {
        const user = await manager.getRepository(User).save(
          manager.getRepository(User).create({
            fullName: dto.fullName,
            email: dto.email.toLowerCase(),
            phone: dto.phone ?? null,
            passwordHash,
            role: UserRole.DOCTOR,
            isActive: true,
          }),
        );

        const doctor = await manager.getRepository(Doctor).save(
          manager.getRepository(Doctor).create({
            user,
            specialization,
            qualifications: dto.qualifications,
            experienceYears: dto.experienceYears,
            consultationFee: String(dto.consultationFee),
            professionalInfo: dto.professionalInfo ?? null,
            verificationStatus: VerificationStatus.PENDING,
          }),
        );

        return { user, doctor };
      });

      return {
        message: 'Doctor registered successfully. Waiting for verification.',
        user: toSafeUser(user),
        doctor: this.format(doctor),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email or phone already exists');
      }
      throw error;
    }
  }

  // Admin: create profile for an existing DOCTOR user
  async create(dto: CreateDoctorDto) {
    const user = await this.userRepository.findOne({ where: { id: dto.userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.DOCTOR) {
      throw new BadRequestException('This user does not have the DOCTOR role');
    }

    const existing = await this.doctorRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (existing) {
      throw new ConflictException('Doctor profile already exists');
    }

    const specialization = await this.getActiveSpecialization(dto.specializationId);

    const saved = await this.doctorRepository.save(
      this.doctorRepository.create({
        user,
        specialization,
        qualifications: dto.qualifications,
        experienceYears: dto.experienceYears,
        consultationFee: String(dto.consultationFee),
        professionalInfo: dto.professionalInfo ?? null,
      }),
    );

    return this.format(await this.findRecord(saved.id));
  }

  // Public: approved + active doctors with search/filter/paging
  async findAll(query: DoctorQueryDto) {
    const { page, limit } = query;

    const qb = this.doctorRepository
      .createQueryBuilder('doctor')
      .innerJoinAndSelect('doctor.user', 'user')
      .innerJoinAndSelect('doctor.specialization', 'specialization')
      .where('doctor.verificationStatus = :status', {
        status: VerificationStatus.APPROVED,
      })
      .andWhere('user.isActive = true')
      .andWhere('specialization.isActive = true');

    if (query.search?.trim()) {
      qb.andWhere('user.fullName ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    if (query.specializationId) {
      qb.andWhere('specialization.id = :specializationId', {
        specializationId: query.specializationId,
      });
    }

    const [doctors, total] = await qb
      .orderBy('user.fullName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return paginate(doctors.map((d) => this.format(d)), total, page, limit);
  }

  // Public: one approved + active doctor
  async findOne(id: string) {
    const doctor = await this.findRecord(id);

    if (
      doctor.verificationStatus !== VerificationStatus.APPROVED ||
      !doctor.user.isActive
    ) {
      throw new NotFoundException('Doctor not found or not currently available');
    }

    return this.format(doctor);
  }

  async findAllForAdmin() {
    const doctors = await this.doctorRepository.find({
      relations: { user: true, specialization: true },
      order: { createdAt: 'DESC' },
    });

    return doctors.map((d) => this.format(d));
  }

  async findMyProfile(userId: string) {
    const doctor = await this.doctorRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true, specialization: true },
    });

    if (!doctor) {
      throw new NotFoundException('Your doctor profile was not found');
    }

    return this.format(doctor);
  }

  async update(
    id: string,
    dto: UpdateDoctorDto,
    requesterId: string,
    requesterRole: UserRole,
  ) {
    const doctor = await this.findRecord(id);

    if (requesterRole !== UserRole.ADMIN && doctor.user.id !== requesterId) {
      throw new ForbiddenException('You can only update your own doctor profile');
    }

    if (dto.specializationId !== undefined) {
      doctor.specialization = await this.getActiveSpecialization(dto.specializationId);
    }
    if (dto.qualifications !== undefined) doctor.qualifications = dto.qualifications;
    if (dto.experienceYears !== undefined) doctor.experienceYears = dto.experienceYears;
    if (dto.consultationFee !== undefined) doctor.consultationFee = String(dto.consultationFee);
    if (dto.professionalInfo !== undefined) doctor.professionalInfo = dto.professionalInfo;

    await this.doctorRepository.save(doctor);

    return this.format(await this.findRecord(id));
  }

  async verify(id: string, dto: VerifyDoctorDto) {
    const doctor = await this.findRecord(id);

    doctor.verificationStatus = dto.verificationStatus;
    await this.doctorRepository.save(doctor);

    return {
      message: `Doctor verification status updated to ${doctor.verificationStatus}`,
      doctor: this.format(doctor),
    };
  }

  async remove(id: string) {
    const doctor = await this.findRecord(id);

    try {
      await this.doctorRepository.remove(doctor);
    } catch (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException(
          'Doctor has appointments or prescriptions; deactivate the user account instead',
        );
      }
      throw error;
    }

    return { message: 'Doctor profile deleted successfully' };
  }
}
