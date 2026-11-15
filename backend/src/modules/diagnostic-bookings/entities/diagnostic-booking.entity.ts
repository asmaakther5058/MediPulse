
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
import { sqlIn } from '../../../common/utils/sql.util.js';

import { DiagnosticBookingStatus } from '../../../common/enums/diagnostic-booking-status.enum.js';
import { Patient } from '../../patients/entities/patient.entity.js';
import { DiagnosticCenter } from '../../diagnostic-centers/entities/diagnostic-center.entity.js';
import { TestRecommendation } from '../../test-recommendations/entities/test-recommendation.entity.js';

@Entity('diagnostic_bookings')
@Check('chk_booking_status', `"status" IN (${sqlIn(DiagnosticBookingStatus)})`)
// One live booking per recommendation
@Index('uq_booking_active_recommendation', ['recommendation'], {
  unique: true,
  where: `"status" NOT IN ('CANCELLED', 'REJECTED')`,
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

  @Column({
    type: 'varchar',
    length: 20,
    default: DiagnosticBookingStatus.PENDING,
  })
  status: DiagnosticBookingStatus;

  @Column({ name: 'patient_note', type: 'text', nullable: true })
  patientNote: string | null;

  @Column({ name: 'center_note', type: 'text', nullable: true })
  centerNote: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Patient, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => DiagnosticCenter, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'diagnostic_center_id' })
  diagnosticCenter: DiagnosticCenter;

  @ManyToOne(() => TestRecommendation, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recommendation_id' })
  recommendation: TestRecommendation;
}
