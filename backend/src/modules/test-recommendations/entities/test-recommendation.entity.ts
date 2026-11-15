
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  Index,
  Unique,
} from 'typeorm';
import { sqlIn } from '../../../common/utils/sql.util.js';

import { RecommendationStatus } from '../../../common/enums/recommendation-status.enum.js';
import { Patient } from '../../patients/entities/patient.entity.js';
import { Doctor } from '../../doctors/entities/doctor.entity.js';
import { Appointment } from '../../appointments/entities/appointment.entity.js';
import { DiagnosticTest } from '../../diagnostic-tests/entities/diagnostic-test.entity.js';

@Entity('test_recommendations')
@Unique('uq_appointment_diagnostic_test', ['appointment', 'diagnosticTest'])
@Check('chk_recommendation_status', `"status" IN (${sqlIn(RecommendationStatus)})`)
@Index('idx_recommendations_patient', ['patient'])
@Index('idx_recommendations_doctor', ['doctor'])
export class TestRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @ManyToOne(() => Appointment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @ManyToOne(() => DiagnosticTest, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'diagnostic_test_id' })
  diagnosticTest: DiagnosticTest;

  @Column({
    name: 'recommendation_note',
    type: 'text',
    nullable: true,
  })
  recommendationNote: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: RecommendationStatus.RECOMMENDED,
  })
  status: RecommendationStatus;

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
