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
import { sqlIn } from '../../../common/utils/sql.util.js';

import { Appointment } from '../../appointments/entities/appointment.entity.js';
import { PaymentStatus } from '../../../common/enums/payment-status.enum.js';

@Entity('payments')
@Check('chk_payments_status', `"status" IN (${sqlIn(PaymentStatus)})`)
@Check('chk_payments_amount', `"amount" >= 0`)
// At most one PENDING or PAID payment per appointment
@Index('uq_payments_active_per_appointment', ['appointment'], {
  unique: true,
  where: `"status" IN ('PENDING', 'PAID')`,
})
@Index('idx_payments_appointment', ['appointment'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Appointment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

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
