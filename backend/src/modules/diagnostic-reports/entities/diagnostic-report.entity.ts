import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Exclude } from 'class-transformer';

import { DiagnosticBooking } from '../../diagnostic-bookings/entities/diagnostic-booking.entity.js';
import { User } from '../../users/entities/user.entity.js';

// The result of one completed test booking: findings and/or an uploaded file
@Entity('diagnostic_reports')
@Check('chk_report_has_content', `"findings" IS NOT NULL OR "file_path" IS NOT NULL`)
export class DiagnosticReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => DiagnosticBooking, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking: Relation<DiagnosticBooking>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy: Relation<User> | null;

  @Column({ type: 'text', nullable: true })
  findings: string | null;

  // Relative path under UPLOAD_DIR; never exposed to clients
  @Exclude()
  @Column({ name: 'file_path', type: 'varchar', length: 255, nullable: true })
  filePath: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ name: 'file_size', type: 'integer', nullable: true })
  fileSize: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
