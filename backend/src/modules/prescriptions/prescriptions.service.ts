import { AppointmentStatus } from '../../common/enums/appointment-status.enum.js';
 
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Prescription } from './entities/prescription.entity.js';
import { PrescriptionMedicine } from './entities/prescription-medicine.entity.js';

import { Appointment } from '../appointments/entities/appointment.entity.js';
import { Patient } from '../patients/entities/patient.entity.js';
import { Doctor } from '../doctors/entities/doctor.entity.js';

import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto.js';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,

    @InjectRepository(PrescriptionMedicine)
    private readonly medicineRepository: Repository<PrescriptionMedicine>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
  ) {}

  // Create prescription for a completed appointment
  async create(
    doctorUserId: string,
    dto: CreatePrescriptionDto,
  ) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id: dto.appointmentId },
      relations: {
        patient: { user: true },
        doctor: { user: true },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.doctor.user.id !== doctorUserId) {
      throw new ForbiddenException(
        'You can only create prescriptions for your own appointments.',
      );
    }

    if (appointment.status !== AppointmentStatus.COMPLETED) {
      throw new BadRequestException(
        'Prescription can only be created for completed appointments.',
      );
    }

    const existingPrescription =
      await this.prescriptionRepository.findOne({
        where: {
          appointment: { id: appointment.id },
        },
      });

    if (existingPrescription) {
      throw new ConflictException(
        'A prescription already exists for this appointment.',
      );
    }

    if (!dto.medicines || dto.medicines.length === 0) {
      throw new BadRequestException(
        'At least one medicine is required.',
      );
    }

    const prescription = this.prescriptionRepository.create({
      appointment,
      patient: appointment.patient,
      doctor: appointment.doctor,
      diagnosis: dto.diagnosis,
      advice: dto.advice ?? null,
      followUpDate: dto.followUpDate ?? null,
      medicines: dto.medicines.map((medicine) =>
        this.medicineRepository.create({
          ...medicine,
        }),
      ),
    });

    try {
      const savedPrescription =
        await this.prescriptionRepository.save(prescription);

      return this.findOne(savedPrescription.id);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'A prescription already exists for this appointment.',
        );
      }

      throw error;
    }
  }

  // Get one prescription
  async findOne(id: string) {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: {
        appointment: true,
        patient: { user: true },
        doctor: { user: true },
        medicines: true,
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found.');
    }

    return {
      id: prescription.id,
      appointmentId: prescription.appointment.id,
      patient: {
        id: prescription.patient.id,
        name: prescription.patient.user.fullName,
      },
      doctor: {
        id: prescription.doctor.id,
        name: prescription.doctor.user.fullName,
      },
      diagnosis: prescription.diagnosis,
      advice: prescription.advice,
      followUpDate: prescription.followUpDate,
      medicines: prescription.medicines.map((medicine) => ({
        id: medicine.id,
        medicineName: medicine.medicineName,
        dosage: medicine.dosage,
        frequency: medicine.frequency,
        duration: medicine.duration,
        instructions: medicine.instructions,
      })),
      createdAt: prescription.createdAt,
      updatedAt: prescription.updatedAt,
    };
  }

  // Patient views own prescriptions
  async findForPatient(patientUserId: string) {
    const patient = await this.patientRepository.findOne({
      where: { user: { id: patientUserId } },
    });

    if (!patient) {
      throw new NotFoundException('Patient profile not found.');
    }

    const prescriptions = await this.prescriptionRepository.find({
      where: { patient: { id: patient.id } },
      relations: {
        appointment: true,
        patient: { user: true },
        doctor: { user: true },
        medicines: true,
      },
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      prescriptions.map((prescription) =>
        this.findOne(prescription.id),
      ),
    );
  }

  // Doctor views own prescriptions
  async findForDoctor(doctorUserId: string) {
    const doctor = await this.doctorRepository.findOne({
      where: { user: { id: doctorUserId } },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found.');
    }

    const prescriptions = await this.prescriptionRepository.find({
      where: { doctor: { id: doctor.id } },
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      prescriptions.map((prescription) =>
        this.findOne(prescription.id),
      ),
    );
  }

  // Admin views all prescriptions
  async findAll() {
    const prescriptions = await this.prescriptionRepository.find({
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      prescriptions.map((prescription) =>
        this.findOne(prescription.id),
      ),
    );
  }

  // Doctor updates own prescription; Admin can update any
  async update(
    id: string,
    userId: string,
    isAdmin: boolean,
    dto: UpdatePrescriptionDto,
  ) {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: {
        doctor: { user: true },
        medicines: true,
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found.');
    }

    if (!isAdmin && prescription.doctor.user.id !== userId) {
      throw new ForbiddenException(
        'You can only update your own prescriptions.',
      );
    }

    if (dto.diagnosis !== undefined) {
      prescription.diagnosis = dto.diagnosis;
    }

    if (dto.advice !== undefined) {
      prescription.advice = dto.advice;
    }

    if (dto.followUpDate !== undefined) {
      prescription.followUpDate = dto.followUpDate;
    }

    if (dto.medicines !== undefined) {
      if (dto.medicines.length === 0) {
        throw new BadRequestException(
          'At least one medicine is required.',
        );
      }

      prescription.medicines = dto.medicines.map((medicine) =>
        this.medicineRepository.create({
          ...medicine,
        }),
      );
    }

    await this.prescriptionRepository.save(prescription);

    return this.findOne(id);
  }

  // Admin deletes a prescription
  async remove(id: string) {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found.');
    }

    await this.prescriptionRepository.remove(prescription);

    return {
      message: 'Prescription deleted successfully.',
    };
  }
}
