import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { Patient } from './entities/patient.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { Prescription } from '../prescriptions/entities/prescription.entity.js';

import { CreatePatientDto } from './dto/create-patient.dto.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';

import { UserRole } from '../../common/enums/user-role.enum.js';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum.js';
import { generatePatientCode } from '../../common/utils/codes.util.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';
import { DiagnosticBooking } from '../diagnostic-bookings/entities/diagnostic-booking.entity.js';
import { DiagnosticReport } from '../diagnostic-reports/entities/diagnostic-report.entity.js';
import { TestRecommendation } from '../test-recommendations/entities/test-recommendation.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { DiagnosticBookingStatus } from '../../common/enums/diagnostic-booking-status.enum.js';
import { RecommendationStatus } from '../../common/enums/recommendation-status.enum.js';
import { AppointmentCategory, CATEGORY_STATUSES } from '../../common/enums/appointment-status.enum.js';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto.js';
import { expireStaleHolds } from '../../common/utils/appointment.util.js';

// A doctor has a care relationship with a patient only through
// a paid appointment (not a rejected/cancelled/unpaid one).
const CARE_RELATIONSHIP_STATUSES = [
  AppointmentStatus.PENDING_DOCTOR,
  AppointmentStatus.ACCEPTED,
  AppointmentStatus.COMPLETED,
];

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,

    private readonly dataSource: DataSource,
  ) {}

  private format(patient: Patient) {
    return {
      id: patient.id,
      patientCode: patient.patientCode,
      user: patient.user
        ? {
            id: patient.user.id,
            fullName: patient.user.fullName,
            email: patient.user.email,
            phone: patient.user.phone,
          }
        : undefined,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      bloodGroup: patient.bloodGroup,
      address: patient.address,
      emergencyContact: patient.emergencyContact,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    };
  }

  private async findRecord(id: string) {
    const patient = await this.patientRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!patient) {
      throw new NotFoundException(`Patient profile with ID ${id} not found`);
    }

    return patient;
  }

  private checkOwnership(patient: Patient, requesterId: string, role: UserRole) {
    if (role !== UserRole.ADMIN && patient.user.id !== requesterId) {
      throw new ForbiddenException(
        'You are not allowed to access another patient profile',
      );
    }
  }

  // Patient creates a profile if they don't have one yet
  // (normally created by POST /auth/register)
  async create(userId: string, dto: CreatePatientDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.PATIENT) {
      throw new BadRequestException('Only patient users can create a patient profile');
    }

    try {
      const saved = await this.patientRepository.save(
        this.patientRepository.create({
          user,
          patientCode: generatePatientCode(),
          dateOfBirth: dto.dateOfBirth ?? null,
          gender: dto.gender ?? null,
          bloodGroup: dto.bloodGroup ?? null,
          address: dto.address ?? null,
          emergencyContact: dto.emergencyContact ?? null,
        }),
      );

      return this.format(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Patient profile already exists for this user');
      }
      throw error;
    }
  }

  async findAll(query: PaginationQueryDto) {
    const { page, limit } = query;
    const [patients, total] = await this.patientRepository.findAndCount({
      relations: { user: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(patients.map((p) => this.format(p)), total, page, limit);
  }

  // Patient overview (spec 3A)
  async dashboard(userId: string) {
    const patient = await this.findMine(userId);
    await expireStaleHolds(this.dataSource.manager);

    const mine = { patient: { id: patient.id } };
    const countIn = (statuses: string[]) =>
      this.appointmentRepository.count({ where: statuses.map((status) => ({ ...mine, status })) as never });

    const [total, upcoming, completed, cancelled, pendingTests, completedTests, notifications, next] = await Promise.all([
      this.appointmentRepository.count({ where: mine }),
      countIn(CATEGORY_STATUSES[AppointmentCategory.UPCOMING]),
      countIn(CATEGORY_STATUSES[AppointmentCategory.COMPLETED]),
      countIn(CATEGORY_STATUSES[AppointmentCategory.CANCELLED]),
      this.dataSource.getRepository(TestRecommendation).count({ where: { ...mine, status: RecommendationStatus.PENDING } }),
      this.dataSource.getRepository(DiagnosticBooking).count({ where: { ...mine, status: DiagnosticBookingStatus.COMPLETED } }),
      this.dataSource.getRepository(Notification).find({
        where: { recipient: { id: userId } },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.appointmentRepository.findOne({
        where: CATEGORY_STATUSES[AppointmentCategory.UPCOMING].map((status) => ({ ...mine, status })) as never,
        relations: { doctor: { user: true, specialization: true } },
        order: { appointmentDate: 'ASC', startTime: 'ASC' },
      }),
    ]);

    return {
      patientName: patient.user.fullName,
      patientCode: patient.patientCode,
      appointments: { total, upcoming, completed, cancelled },
      pendingTestRecommendations: pendingTests,
      completedDiagnosticTests: completedTests,
      nextAppointment: next
        ? {
            id: next.id,
            appointmentDate: next.appointmentDate,
            startTime: next.startTime,
            status: next.status,
            doctor: next.doctor.user.fullName,
            specialization: next.doctor.specialization?.name,
          }
        : null,
      recentNotifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    };
  }

  async findMine(userId: string) {
    const patient = await this.patientRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return patient;
  }

  async findMyProfile(userId: string) {
    return this.format(await this.findMine(userId));
  }

  async updateMyProfile(userId: string, dto: UpdatePatientDto) {
    const patient = await this.findMine(userId);
    Object.assign(patient, dto);
    return this.format(await this.patientRepository.save(patient));
  }

  async findOne(id: string, requesterId: string, role: UserRole) {
    const patient = await this.findRecord(id);
    this.checkOwnership(patient, requesterId, role);
    return this.format(patient);
  }

  async update(id: string, dto: UpdatePatientDto, requesterId: string, role: UserRole) {
    const patient = await this.findRecord(id);
    this.checkOwnership(patient, requesterId, role);
    Object.assign(patient, dto);
    return this.format(await this.patientRepository.save(patient));
  }

  async remove(id: string, requesterId: string, role: UserRole) {
    const patient = await this.findRecord(id);
    this.checkOwnership(patient, requesterId, role);

    try {
      await this.patientRepository.remove(patient);
    } catch (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException(
          'Patient has appointments or bookings; the profile cannot be deleted',
        );
      }
      throw error;
    }

    return { message: 'Patient profile deleted successfully' };
  }

  // Appointments + prescriptions for one patient.
  // Patient: own history. Doctor: only their own appointments with
  // a patient they have a care relationship with. Admin: everything.
  async getMedicalHistory(patientId: string, requesterId: string, role: UserRole) {
    const patient = await this.findRecord(patientId);

    const where: Record<string, unknown> = { patient: { id: patientId } };

    if (role === UserRole.PATIENT) {
      this.checkOwnership(patient, requesterId, role);
    } else if (role === UserRole.DOCTOR) {
      const relationship = await this.appointmentRepository.findOne({
        where: {
          patient: { id: patientId },
          doctor: { user: { id: requesterId } },
          status: In(CARE_RELATIONSHIP_STATUSES),
        },
      });

      if (!relationship) {
        throw new ForbiddenException(
          'You are not allowed to access this patient medical history',
        );
      }

      where.doctor = { user: { id: requesterId } };
    } else if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not allowed to access this medical history');
    }

    // Test bookings and reports: every one of this patient's, for the patient,
    // an admin, or a doctor already checked above to be treating them (spec 4F)
    const bookingWhere = { patient: { id: patientId } };

    const [appointments, prescriptions, bookings, reports] = await Promise.all([
      this.appointmentRepository.find({
        where,
        relations: { doctor: { user: true, specialization: true } },
        order: { appointmentDate: 'DESC', startTime: 'DESC' },
      }),
      this.prescriptionRepository.find({
        where,
        relations: { medicines: true, doctor: { user: true }, appointment: true },
        order: { createdAt: 'DESC' },
      }),
      this.dataSource.getRepository(DiagnosticBooking).find({
        where: bookingWhere,
        relations: { recommendation: { diagnosticTest: true, doctor: { user: true } } },
        order: { bookingDate: 'DESC' },
      }),
      this.dataSource.getRepository(DiagnosticReport).find({
        where: { booking: bookingWhere },
        relations: { booking: { recommendation: { diagnosticTest: true } } },
        order: { createdAt: 'DESC' },
      }),
    ]);

    return {
      patient: this.format(patient),
      totalAppointments: appointments.length,
      appointments: appointments.map((a) => ({
        id: a.id,
        doctor: {
          id: a.doctor.id,
          fullName: a.doctor.user?.fullName,
          specialization: a.doctor.specialization?.name,
        },
        appointmentDate: a.appointmentDate,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        patientNote: a.patientNote,
        createdAt: a.createdAt,
      })),
      // Diagnoses are written in each prescription (spec decision);
      // listed here on their own as a quick timeline
      diagnoses: prescriptions.map((p) => ({
        prescriptionId: p.id,
        appointmentId: p.appointment?.id,
        appointmentDate: p.appointment?.appointmentDate,
        doctorName: p.doctor.user?.fullName,
        diagnosis: p.diagnosis,
        createdAt: p.createdAt,
      })),
      prescriptions: prescriptions.map((p) => ({
        id: p.id,
        appointmentId: p.appointment?.id,
        doctorName: p.doctor.user?.fullName,
        diagnosis: p.diagnosis,
        advice: p.advice,
        followUpDate: p.followUpDate,
        medicines: p.medicines,
        pdfUrl: `/prescriptions/${p.id}/pdf`,
        createdAt: p.createdAt,
      })),
      diagnosticBookings: bookings.map((b) => ({
        id: b.id,
        testName: b.recommendation.diagnosticTest.testName,
        recommendedBy: b.recommendation.doctor.user.fullName,
        bookingDate: b.bookingDate,
        status: b.status,
        completedAt: b.completedAt,
      })),
      diagnosticReports: reports.map((r) => ({
        id: r.id,
        bookingId: r.booking.id,
        testName: r.booking.recommendation.diagnosticTest.testName,
        findings: r.findings,
        downloadUrl: r.filePath ? `/diagnostic-reports/${r.id}/download` : null,
        createdAt: r.createdAt,
      })),
    };
  }
}
