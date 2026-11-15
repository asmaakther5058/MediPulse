import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Appointment } from './entities/appointment.entity.js';
import { Doctor } from '../doctors/entities/doctor.entity.js';
import { DoctorAvailability } from '../doctor-availability/entities/doctor-availability.entity.js';

import { VerificationStatus } from '../../common/enums/verification-status.enum.js';
import {
  AppointmentStatus,
  SLOT_BLOCKING_STATUSES,
} from '../../common/enums/appointment-status.enum.js';
import { slotStartInstant, todayInAppZone, weekdayOf } from '../../common/utils/date.util.js';

// Patient-facing view of a doctor's slots on one date
@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(DoctorAvailability)
    private readonly availabilityRepository: Repository<DoctorAvailability>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  async findSlotsForDate(doctorId: string, date: string) {
    const dayOfWeek = weekdayOf(date);

    if (date < todayInAppZone()) {
      throw new BadRequestException('You cannot view availability for a past date');
    }

    const doctor = await this.doctorRepository.findOne({
      where: {
        id: doctorId,
        verificationStatus: VerificationStatus.APPROVED,
        user: { isActive: true },
      },
    });

    if (!doctor) {
      throw new NotFoundException('Active approved doctor not found');
    }

    const schedule = await this.availabilityRepository.find({
      where: { doctor: { id: doctorId }, dayOfWeek, isAvailable: true },
      order: { startTime: 'ASC' },
    });

    const now = new Date();

    const appointments = await this.appointmentRepository.find({
      where: {
        doctor: { id: doctorId },
        appointmentDate: date,
        status: In([...SLOT_BLOCKING_STATUSES, AppointmentStatus.PENDING_PAYMENT]),
      },
      relations: { availability: true },
    });

    // An unpaid booking only blocks the slot while its hold is valid
    const takenSlotIds = new Set(
      appointments
        .filter(
          (a) =>
            a.status !== AppointmentStatus.PENDING_PAYMENT ||
            (a.holdExpiresAt !== null && a.holdExpiresAt > now),
        )
        .map((a) => a.availability.id),
    );

    const slots = schedule.map((slot) => ({
      availabilityId: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isAvailable:
        !takenSlotIds.has(slot.id) && slotStartInstant(date, slot.startTime) > now,
    }));

    return {
      doctorId,
      date,
      dayOfWeek,
      consultationFee: doctor.consultationFee,
      totalSlots: slots.length,
      availableSlots: slots.filter((s) => s.isAvailable).length,
      slots,
    };
  }
}
