import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  Index,
} from 'typeorm';
import { sqlIn } from '../../../common/utils/sql.util.js';

import { Patient } from '../../patients/entities/patient.entity.js';
import { Doctor } from '../../doctors/entities/doctor.entity.js';
import { DoctorAvailability } from '../../doctor-availability/entities/doctor-availability.entity.js';
import { AppointmentStatus } from '../../../common/enums/appointment-status.enum.js';

@Entity('appointments')
@Check('chk_appointments_status', `"status" IN (${sqlIn(AppointmentStatus)})`)
@Check('chk_appointments_fee', `"consultation_fee" >= 0`)
// One live booking per slot per date (cancelled/rejected free the slot)
@Index('uq_appointment_active_slot', ['availability', 'appointmentDate'], {
  unique: true,
  where: `"status" NOT IN ('CANCELLED', 'REJECTED')`,
})
@Index('idx_appointments_patient', ['patient'])
@Index('idx_appointments_doctor', ['doctor'])
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @ManyToOne(() => DoctorAvailability, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'availability_id' })
  availability: DoctorAvailability;

  @Column({ name: 'appointment_date', type: 'date' })
  appointmentDate: string;

  // Snapshot of the slot time and fee at booking time
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ name: 'consultation_fee', type: 'numeric', precision: 10, scale: 2 })
  consultationFee: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: AppointmentStatus.PENDING_PAYMENT,
  })
  status: AppointmentStatus;

  // Slot is reserved until this time while status = PENDING_PAYMENT
  @Column({ name: 'hold_expires_at', type: 'timestamptz', nullable: true })
  holdExpiresAt: Date | null;

  @Column({ name: 'patient_note', type: 'text', nullable: true })
  patientNote: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
