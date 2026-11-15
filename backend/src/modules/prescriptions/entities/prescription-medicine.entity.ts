 
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import type { Relation } from 'typeorm';
import { Prescription } from './prescription.entity.js';

@Entity('prescription_medicines')
@Index('idx_prescription_medicines_prescription', ['prescription'])
export class PrescriptionMedicine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => Prescription,
    (prescription) => prescription.medicines,
    { nullable: false, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'prescription_id' })
  prescription: Relation<Prescription>;

  @Column({
    name: 'medicine_name',
    type: 'varchar',
    length: 150,
  })
  medicineName: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  dosage: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  frequency: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  duration: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  instructions: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;
}
