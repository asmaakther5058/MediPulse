import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { sqlIn } from '../../../common/utils/sql.util.js';

import { User } from '../../users/entities/user.entity.js';
import { Specialization } from '../../specializations/entities/specialization.entity.js';
import { VerificationStatus } from '../../../common/enums/verification-status.enum.js';

@Entity('doctor_profiles')
@Check('chk_doctor_experience', `"experience_years" >= 0`)
@Check('chk_doctor_fee', `"consultation_fee" >= 0`)
@Check('chk_doctor_verification_status', `"verification_status" IN (${sqlIn(VerificationStatus)})`)
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => Specialization, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialization_id' })
  specialization: Relation<Specialization>;

  @Column({ type: 'text' })
  qualifications: string;

  @Column({ name: 'experience_years', type: 'integer', default: 0 })
  experienceYears: number;

  @Column({ name: 'consultation_fee', type: 'numeric', precision: 10, scale: 2 })
  consultationFee: string;

  @Column({ name: 'professional_info', type: 'text', nullable: true })
  professionalInfo: string | null;

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
