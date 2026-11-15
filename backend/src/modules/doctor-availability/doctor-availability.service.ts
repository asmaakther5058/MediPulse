import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DoctorAvailability } from './entities/doctor-availability.entity.js';
import { Doctor } from '../doctors/entities/doctor.entity.js';

import { CreateDoctorAvailabilityDto } from './dto/create-doctor-availability.dto.js';
import { UpdateDoctorAvailabilityDto } from './dto/update-doctor-availability.dto.js';

import { UserRole } from '../../common/enums/user-role.enum.js';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto.js';
import { VerificationStatus } from '../../common/enums/verification-status.enum.js';

const SLOT_MINUTES = 20;
const OPENING_MINUTES = 10 * 60; // 10:00
const CLOSING_MINUTES = 22 * 60; // 22:00

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}:00`;
}

@Injectable()
export class DoctorAvailabilityService {
  constructor(
    @InjectRepository(DoctorAvailability)
    private readonly availabilityRepository: Repository<DoctorAvailability>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
  ) {}

  private async getDoctor(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    return doctor;
  }

  async create(userId: string, dto: CreateDoctorAvailabilityDto) {
    const doctor = await this.getDoctor(userId);

    if (doctor.verificationStatus !== VerificationStatus.APPROVED) {
      throw new ForbiddenException('Your doctor profile is not approved yet');
    }

    const start = toMinutes(dto.startTime);
    const end = toMinutes(dto.endTime);

    if (start < OPENING_MINUTES || end > CLOSING_MINUTES || start >= end) {
      throw new BadRequestException('Schedule must be between 10:00 and 22:00');
    }

    if (
      (start - OPENING_MINUTES) % SLOT_MINUTES !== 0 ||
      (end - start) % SLOT_MINUTES !== 0
    ) {
      throw new BadRequestException(
        'Schedule must follow 20-minute intervals starting from 10:00',
      );
    }

    const overlapping = await this.availabilityRepository
      .createQueryBuilder('availability')
      .innerJoin('availability.doctor', 'doctor')
      .where('doctor.id = :doctorId', { doctorId: doctor.id })
      .andWhere('availability.dayOfWeek = :day', { day: dto.dayOfWeek })
      .andWhere('availability.startTime < :endTime', { endTime: toTime(end) })
      .andWhere('availability.endTime > :startTime', { startTime: toTime(start) })
      .getOne();

    if (overlapping) {
      throw new ConflictException('This schedule overlaps with an existing schedule');
    }

    const slots: DoctorAvailability[] = [];

    for (let t = start; t < end; t += SLOT_MINUTES) {
      slots.push(
        this.availabilityRepository.create({
          doctor,
          dayOfWeek: dto.dayOfWeek,
          startTime: toTime(t),
          endTime: toTime(t + SLOT_MINUTES),
          isAvailable: true,
        }),
      );
    }

    const saved = await this.availabilityRepository.save(slots);

    return saved.map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isAvailable: slot.isAvailable,
    }));
  }

  // Doctor: own slots. Admin: everyone's. limit up to 50 per page.
  async findAll(userId: string, role: UserRole, query: PaginationQueryDto) {
    const { page, limit } = query;
    const where = role === UserRole.ADMIN ? {} : { doctor: { id: (await this.getDoctor(userId)).id } };

    const [slots, total] = await this.availabilityRepository.findAndCount({
      where,
      relations: role === UserRole.ADMIN ? { doctor: true } : {},
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(slots, total, page, limit);
  }

  async findOne(id: string, userId: string, role: UserRole) {
    const availability = await this.availabilityRepository.findOne({
      where: { id },
      relations: { doctor: { user: true } },
    });

    if (!availability) {
      throw new NotFoundException('Availability slot not found');
    }

    if (role !== UserRole.ADMIN && availability.doctor.user.id !== userId) {
      throw new ForbiddenException('You do not have permission to access this schedule');
    }

    return availability;
  }

  async update(id: string, dto: UpdateDoctorAvailabilityDto, userId: string, role: UserRole) {
    const availability = await this.findOne(id, userId, role);

    if (dto.isAvailable !== undefined) {
      availability.isAvailable = dto.isAvailable;
    }

    const saved = await this.availabilityRepository.save(availability);

    return {
      id: saved.id,
      dayOfWeek: saved.dayOfWeek,
      startTime: saved.startTime,
      endTime: saved.endTime,
      isAvailable: saved.isAvailable,
    };
  }

  async remove(id: string, userId: string, role: UserRole) {
    const availability = await this.findOne(id, userId, role);

    try {
      await this.availabilityRepository.remove(availability);
    } catch (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException(
          'This slot has appointments; set isAvailable to false instead of deleting it',
        );
      }
      throw error;
    }

    return { message: 'Availability slot deleted successfully' };
  }
}
