
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DiagnosticBookingStatus } from '../../common/enums/diagnostic-booking-status.enum.js';
import { RecommendationStatus } from '../../common/enums/recommendation-status.enum.js';
import { VerificationStatus } from '../../common/enums/verification-status.enum.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';
import { DiagnosticBooking } from './entities/diagnostic-booking.entity.js';
import { CreateDiagnosticBookingDto } from './dto/create-diagnostic-booking.dto.js';

import { Patient } from '../patients/entities/patient.entity.js';
import { DiagnosticCenter } from '../diagnostic-centers/entities/diagnostic-center.entity.js';
import { TestRecommendation } from '../test-recommendations/entities/test-recommendation.entity.js';

@Injectable()
export class DiagnosticBookingsService {
  constructor(
    @InjectRepository(DiagnosticBooking)
    private readonly bookingRepository: Repository<DiagnosticBooking>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(DiagnosticCenter)
    private readonly centerRepository: Repository<DiagnosticCenter>,

    @InjectRepository(TestRecommendation)
    private readonly recommendationRepository: Repository<TestRecommendation>,
  ) {}

  private formatBooking(booking: DiagnosticBooking) {
    return {
      id: booking.id,
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      status: booking.status,
      patientNote: booking.patientNote,
      centerNote: booking.centerNote,
      cancellationReason: booking.cancellationReason,
      patient: booking.patient
        ? {
            id: booking.patient.id,
            name: booking.patient.user?.fullName,
          }
        : undefined,
      diagnosticCenter: booking.diagnosticCenter
        ? {
            id: booking.diagnosticCenter.id,
            centerName: booking.diagnosticCenter.centerName,
          }
        : undefined,
      recommendation: booking.recommendation
        ? {
            id: booking.recommendation.id,
            status: booking.recommendation.status,
          }
        : undefined,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  async create(
    patientUserId: string,
    dto: CreateDiagnosticBookingDto,
  ) {
    const patient = await this.patientRepository.findOne({
      where: { user: { id: patientUserId } },
      relations: {
        user: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    const recommendation = await this.recommendationRepository.findOne({
      where: {
        id: dto.recommendationId,
        patient: { id: patient.id },
      },
      relations: {
        patient: true,
      },
    });

    if (!recommendation) {
      throw new NotFoundException(
        'Test recommendation not found for this patient',
      );
    }

    if (recommendation.status !== RecommendationStatus.RECOMMENDED) {
      throw new ConflictException(
        'This recommendation is not available for booking',
      );
    }

    const center = await this.centerRepository.findOne({
      where: { id: dto.diagnosticCenterId },
    });

    if (!center) {
      throw new NotFoundException('Diagnostic center not found');
    }

    if (center.verificationStatus !== VerificationStatus.APPROVED) {
      throw new ForbiddenException(
        'This diagnostic center is not approved',
      );
    }

    const bookingDate = new Date(`${dto.bookingDate}T00:00:00+06:00`);
    const today = new Date(
      new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
      }),
    );

    today.setHours(0, 0, 0, 0);

    if (
      Number.isNaN(bookingDate.getTime()) ||
      bookingDate < today
    ) {
      throw new BadRequestException(
        'Booking date cannot be in the past',
      );
    }

    const booking = this.bookingRepository.create({
      patient,
      recommendation,
      diagnosticCenter: center,
      bookingDate: dto.bookingDate,
      bookingTime: dto.bookingTime ?? null,
      patientNote: dto.patientNote ?? null,
      status: DiagnosticBookingStatus.PENDING,
    });

    try {
      await this.bookingRepository.save(booking);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'This recommendation already has an active booking',
        );
      }
      throw error;
    }

    recommendation.status = RecommendationStatus.BOOKED;
    await this.recommendationRepository.save(recommendation);

    return this.findOne(booking.id);
  }

  async findOne(id: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: {
          patient: {
           user: true,
   },
  diagnosticCenter: true,
  recommendation: true,
},
    });

    if (!booking) {
      throw new NotFoundException('Diagnostic booking not found');
    }

    return this.formatBooking(booking);
  }

  async findForPatient(patientUserId: string) {
    const bookings = await this.bookingRepository.find({
      where: {
        patient: { user: { id: patientUserId } },
      },
      relations: {
  patient: {
    user: true,
  },
  diagnosticCenter: true,
  recommendation: true,
},
      order: { createdAt: 'DESC' },
    });

    return bookings.map((booking) => this.formatBooking(booking));
  }

  async findForCenter(centerUserId: string) {
    const bookings = await this.bookingRepository.find({
      where: {
        diagnosticCenter: { user: { id: centerUserId } },
      },
      relations: {
  patient: {
    user: true,
  },
  diagnosticCenter: true,
  recommendation: true,
},
      order: { createdAt: 'DESC' },
    });

    return bookings.map((booking) => this.formatBooking(booking));
  }

  async findAll() {
    const bookings = await this.bookingRepository.find({
      relations: {
  patient: {
    user: true,
  },
  diagnosticCenter: true,
  recommendation: true,
},
      order: { createdAt: 'DESC' },
    });

    return bookings.map((booking) => this.formatBooking(booking));
  }

  async cancelByPatient(
    id: string,
    patientUserId: string,
    reason?: string,
  ) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: {
        patient: {
          user: true,
        },
        recommendation: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Diagnostic booking not found');
    }

    if (booking.patient.user.id !== patientUserId) {
      throw new ForbiddenException(
        'You cannot cancel another patient booking',
      );
    }

    if (![DiagnosticBookingStatus.PENDING, DiagnosticBookingStatus.ACCEPTED].includes(booking.status)) {
      throw new BadRequestException(
        'This booking cannot be cancelled',
      );
    }

    booking.status = DiagnosticBookingStatus.CANCELLED;
    booking.cancellationReason = reason ?? null;

    await this.bookingRepository.save(booking);

    booking.recommendation.status = RecommendationStatus.RECOMMENDED;
    await this.recommendationRepository.save(booking.recommendation);

    return this.findOne(id);
  }

  async updateStatusByCenter(
    id: string,
    centerUserId: string,
    status: DiagnosticBookingStatus.ACCEPTED | DiagnosticBookingStatus.REJECTED | DiagnosticBookingStatus.COMPLETED,
    note?: string,
  ) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: {
  diagnosticCenter: {
    user: true,
  },
  recommendation: true,
},
    });

    if (!booking) {
      throw new NotFoundException('Diagnostic booking not found');
    }

    if (booking.diagnosticCenter.user.id !== centerUserId) {
      throw new ForbiddenException(
        'You cannot manage another center booking',
      );
    }

    const validTransitions: Partial<Record<DiagnosticBookingStatus, DiagnosticBookingStatus[]>> = {
      [DiagnosticBookingStatus.PENDING]: [DiagnosticBookingStatus.ACCEPTED, DiagnosticBookingStatus.REJECTED],
      [DiagnosticBookingStatus.ACCEPTED]: [DiagnosticBookingStatus.COMPLETED],
    };

    if (!validTransitions[booking.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot change booking status from ${booking.status} to ${status}`,
      );
    }

    booking.status = status;

    if (status === DiagnosticBookingStatus.REJECTED) {
      booking.recommendation.status = RecommendationStatus.RECOMMENDED;
    }

    if (status === DiagnosticBookingStatus.COMPLETED) {
      booking.recommendation.status = RecommendationStatus.COMPLETED;
    }

    booking.centerNote = note ?? booking.centerNote;

    await this.bookingRepository.save(booking);
    await this.recommendationRepository.save(booking.recommendation);

    return this.findOne(id);
  }
}
