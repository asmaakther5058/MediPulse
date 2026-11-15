
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { sqlIn } from '../../../common/utils/sql.util.js';

import { User } from '../../users/entities/user.entity.js';
import { VerificationStatus } from '../../../common/enums/verification-status.enum.js';

@Entity('diagnostic_center_profiles')
@Check('chk_diagnostic_center_verification', `"verification_status" IN (${sqlIn(VerificationStatus)})`)
export class DiagnosticCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'center_name', type: 'varchar', length: 150 })
  centerName: string;

  @Column({ name: 'license_number', type: 'varchar', length: 100, unique: true })
  licenseNumber: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  area: string | null;

  @Column({ name: 'contact_number', type: 'varchar', length: 20 })
  contactNumber: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'verification_status',
    type: 'varchar',
    length: 20,
    default: VerificationStatus.PENDING,
  })
  verificationStatus: VerificationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
