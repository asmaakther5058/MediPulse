import { AppointmentStatus } from '../../common/enums/appointment-status.enum.js';
import { RecommendationStatus } from '../../common/enums/recommendation-status.enum.js';

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TestRecommendation } from './entities/test-recommendation.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { DiagnosticTest } from '../diagnostic-tests/entities/diagnostic-test.entity.js';

import { CreateTestRecommendationDto } from './dto/create-test-recommendation.dto.js';

@Injectable()
export class TestRecommendationsService {
  constructor(
    @InjectRepository(TestRecommendation)
    private readonly recommendationRepository: Repository<TestRecommendation>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(DiagnosticTest)
    private readonly diagnosticTestRepository: Repository<DiagnosticTest>,
  ) {}

  // Doctor creates a test recommendation
  async create(
    doctorUserId: string,
    dto: CreateTestRecommendationDto,
  ) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id: dto.appointmentId },
      relations: {
        patient: { user: true },
        doctor: { user: true },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.doctor.user.id !== doctorUserId) {
      throw new ForbiddenException(
        'You can recommend tests only for your own appointments',
      );
    }

    if (appointment.status !== AppointmentStatus.COMPLETED) {
      throw new BadRequestException(
        'Tests can only be recommended for completed appointments',
      );
    }

    const diagnosticTest =
      await this.diagnosticTestRepository.findOne({
        where: {
          id: dto.diagnosticTestId,
          isActive: true,
        },
      });

    if (!diagnosticTest) {
      throw new NotFoundException(
        'Active diagnostic test not found',
      );
    }

    const recommendation = this.recommendationRepository.create({
      patient: appointment.patient,
      doctor: appointment.doctor,
      appointment,
      diagnosticTest,
      recommendationNote: dto.recommendationNote ?? null,
      status: RecommendationStatus.RECOMMENDED,
    });

    const savedRecommendation =
      await this.recommendationRepository.save(recommendation);

    return this.findOne(savedRecommendation.id);
  }

  // Find one recommendation
  async findOne(id: string) {
    const recommendation =
      await this.recommendationRepository.findOne({
        where: { id },
        relations: {
          patient: { user: true },
          doctor: { user: true },
          diagnosticTest: true,
          appointment: true,
        },
      });

    if (!recommendation) {
      throw new NotFoundException(
        'Test recommendation not found',
      );
    }

    return recommendation;
  }

  // Patient views own recommendations
  async findForPatient(patientUserId: string) {
    return this.recommendationRepository.find({
      where: {
        patient: {
          user: { id: patientUserId },
        },
      },
      relations: {
        patient: { user: true },
        doctor: { user: true },
        diagnosticTest: true,
        appointment: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  // Doctor views own recommendations
  async findForDoctor(doctorUserId: string) {
    return this.recommendationRepository.find({
      where: {
        doctor: {
          user: { id: doctorUserId },
        },
      },
      relations: {
        patient: { user: true },
        doctor: { user: true },
        diagnosticTest: true,
        appointment: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  // Admin views all recommendations
  async findAll() {
    return this.recommendationRepository.find({
      relations: {
        patient: { user: true },
        doctor: { user: true },
        diagnosticTest: true,
        appointment: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
