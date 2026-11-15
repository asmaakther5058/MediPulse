 
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import type { Relation } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Patient } from '../../patients/entities/patient.entity.js';
import { Doctor } from '../../doctors/entities/doctor.entity.js';
import { Appointment } from '../../appointments/entities/appointment.entity.js';
import { PrescriptionMedicine } from '../../prescriptions/entities/prescription-medicine.entity.js';

@Entity('prescriptions')
@Index('idx_prescriptions_patient', ['patient'])
@Index('idx_prescriptions_doctor', ['doctor'])
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Appointment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Relation<Appointment>;

  @ManyToOne(() => Patient, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Relation<Patient>;

  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Relation<Doctor>;

  @Column({ type: 'text' })
  diagnosis: string;

  @Column({ type: 'text', nullable: true })
  advice: string | null;

  @Column({
    name: 'follow_up_date',
    type: 'date',
    nullable: true,
  })
  followUpDate: string | null;

  // Relative path of the generated PDF under UPLOAD_DIR (never sent to clients)
  @Exclude()
  @Column({ name: 'pdf_path', type: 'varchar', length: 255, nullable: true })
  pdfPath: string | null;

  @OneToMany(
  () => PrescriptionMedicine,
  (medicine) => medicine.prescription,
  { cascade: true },
)
medicines: Relation<PrescriptionMedicine[]>;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;
}
