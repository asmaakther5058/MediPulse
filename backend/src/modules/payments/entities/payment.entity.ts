import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { sqlIn } from '../../../common/utils/sql.util.js';

import { Appointment } from '../../appointments/entities/appointment.entity.js';
import { DiagnosticBooking } from '../../diagnostic-bookings/entities/diagnostic-booking.entity.js';
import { PaymentStatus } from '../../../common/enums/payment-status.enum.js';
import { PaymentType } from '../../../common/enums/payment-type.enum.js';

// A payment is for exactly one thing: a consultation OR a diagnostic test.
@Entity('payments')
@Check('chk_payments_status', `"status" IN (${sqlIn(PaymentStatus)})`)
@Check('chk_payments_type', `"payment_type" IN (${sqlIn(PaymentType)})`)
@Check('chk_payments_amount', `"amount" >= 0`)
@Check(
  'chk_payments_target',
  `("payment_type" = 'CONSULTATION' AND "appointment_id" IS NOT NULL AND "diagnostic_booking_id" IS NULL)` +
    ` OR ("payment_type" = 'DIAGNOSTIC_TEST' AND "diagnostic_booking_id" IS NOT NULL AND "appointment_id" IS NULL)`,
)
@Index('idx_payments_appointment', ['appointment'])
@Index('idx_payments_diagnostic_booking', ['diagnosticBooking'])
// At most one PENDING or PAID payment per appointment / per test booking
@Index('uq_payments_active_per_appointment', ['appointment'], {
  unique: true,
  where: `"status" IN ('PENDING', 'PAID') AND "appointment_id" IS NOT NULL`,
})
@Index('uq_payments_active_per_booking', ['diagnosticBooking'], {
  unique: true,
  where: `"status" IN ('PENDING', 'PAID') AND "diagnostic_booking_id" IS NOT NULL`,
})
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_type', type: 'varchar', length: 20, default: PaymentType.CONSULTATION })
  paymentType: PaymentType;

  @ManyToOne(() => Appointment, (appointment) => appointment.payments, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Relation<Appointment> | null;

  @ManyToOne(() => DiagnosticBooking, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'diagnostic_booking_id' })
  diagnosticBooking: Relation<DiagnosticBooking> | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 10, default: 'BDT' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod: string | null;

  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 150,
    nullable: true,
    unique: true,
  })
  transactionId: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
