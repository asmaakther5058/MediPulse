import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { BLOOD_GROUPS } from '../../../common/enums/blood-group.enum.js';
import { sqlIn } from '../../../common/utils/sql.util.js';

import { User } from '../../users/entities/user.entity.js';
import { Gender } from '../../../common/enums/gender.enum.js';

@Entity('patient_profiles')
@Check('chk_patient_gender', `"gender" IS NULL OR "gender" IN (${sqlIn(Gender)})`)
@Check('chk_patient_blood_group', `"blood_group" IS NULL OR "blood_group" IN (${sqlIn(BLOOD_GROUPS)})`)
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'patient_code', type: 'varchar', length: 30, unique: true })
  patientCode: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender: Gender | null;

  @Column({ name: 'blood_group', type: 'varchar', length: 5, nullable: true })
  bloodGroup: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({
    name: 'emergency_contact',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  emergencyContact: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
