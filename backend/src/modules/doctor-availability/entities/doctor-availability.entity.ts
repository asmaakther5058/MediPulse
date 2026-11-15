import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  Unique,
} from 'typeorm';
import { sqlIn } from '../../../common/utils/sql.util.js';

import { Doctor } from '../../doctors/entities/doctor.entity.js';
import { DayOfWeek } from '../../../common/enums/day-of-week.enum.js';

// One row = one bookable 20-minute slot on a weekday
@Entity('doctor_availabilities')
@Unique('uq_doctor_day_start', ['doctor', 'dayOfWeek', 'startTime'])
@Check('chk_doctor_availability_day', `"day_of_week" IN (${sqlIn(DayOfWeek)})`)
// 20-minute slots between 10:00 and 22:00, aligned to 10:00
@Check(
  'chk_doctor_availability_time',
  `"start_time" >= TIME '10:00' AND "end_time" <= TIME '22:00' AND "end_time" = "start_time" + INTERVAL '20 minutes' AND MOD(EXTRACT(EPOCH FROM ("start_time" - TIME '10:00'))::INTEGER, 1200) = 0`,
)
export class DoctorAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'day_of_week', type: 'varchar', length: 10 })
  dayOfWeek: DayOfWeek;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
