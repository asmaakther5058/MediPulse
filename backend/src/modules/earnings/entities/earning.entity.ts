import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { sqlIn } from '../../../common/utils/sql.util.js';

import { Payment } from '../../payments/entities/payment.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { EarningBeneficiaryRole } from '../../../common/enums/earning-beneficiary-role.enum.js';

@Entity('earnings')
@Check('chk_earnings_role', `"beneficiary_role" IN (${sqlIn(EarningBeneficiaryRole)})`)
@Unique(['payment', 'beneficiaryRole'])
export class Earning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'payment_id' })
  payment: Relation<Payment>;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'beneficiary_user_id' })
  beneficiaryUser: Relation<User>;

  @Column({
    name: 'beneficiary_role',
    type: 'varchar',
    length: 20,
  })
  beneficiaryRole: EarningBeneficiaryRole;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({
    name: 'share_percentage',
    type: 'numeric',
    precision: 5,
    scale: 2,
  })
  sharePercentage: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}