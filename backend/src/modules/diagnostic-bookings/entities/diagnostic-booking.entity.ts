import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { sqlIn } from '../../../common/utils/sql.util.js';

import { DiagnosticBookingStatus } from '../../../common/enums/diagnostic-booking-status.enum.js';
import { Patient } from '../../patients/entities/patient.entity.js';
import { DiagnosticCenter } from '../../diagnostic-centers/entities/diagnostic-center.entity.js';
import { TestRecommendation } from '../../test-recommendations/entities/test-recommendation.entity.js';

// Created when the patient approves a recommendation (PENDING_PAYMENT),
// confirmed when the test fee is paid, completed by the center.
@Entity('diagnostic_bookings')
@Check('chk_booking_status', `"status" IN (${sqlIn(DiagnosticBookingStatus)})`)
@Check('chk_booking_price', `"price" >= 0`)
// One live booking per recommendation
@Index('uq_booking_active_recommendation', ['recommendation'], {
  unique: true,
  where: `"status" <> 'CANCELLED'`,
})
@Index('idx_bookings_patient', ['patient'])
@Index('idx_bookings_center', ['diagnosticCenter'])
export class DiagnosticBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_date', type: 'date' })
  bookingDate: string;

  @Column({ name: 'booking_time', type: 'time', nullable: true })
  bookingTime: string | null;

  // Test price at the moment of approval
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: DiagnosticBookingStatus.PENDING_PAYMENT,
  })
  status: DiagnosticBookingStatus;

  @Column({ name: 'patient_note', type: 'text', nullable: true })
  patientNote: string | null;

  @Column({ name: 'center_note', type: 'text', nullable: true })
  centerNote: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Patient, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Relation<Patient>;

  @ManyToOne(() => DiagnosticCenter, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'diagnostic_center_id' })
  diagnosticCenter: Relation<DiagnosticCenter>;

  @ManyToOne(() => TestRecommendation, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recommendation_id' })
  recommendation: Relation<TestRecommendation>;
}
