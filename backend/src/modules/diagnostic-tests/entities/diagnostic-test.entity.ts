
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('diagnostic_tests')
@Index('idx_diagnostic_tests_category', ['category'])
export class DiagnosticTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'test_name', type: 'varchar', length: 150, unique: true })
  testName: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'sample_type', type: 'varchar', length: 100, nullable: true })
  sampleType: string | null;

  @Column({ name: 'preparation_instructions', type: 'text', nullable: true })
  preparationInstructions: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
