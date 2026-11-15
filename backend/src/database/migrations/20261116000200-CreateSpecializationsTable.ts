import { MigrationInterface, QueryRunner } from 'typeorm';

// Doctor specializations (Cardiology, Medicine, ...)
export class CreateSpecializationsTable20261116000200 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "specializations" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_1d4b2b9ff96a76def0bf7195a8f"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_68ccfdea9eca4570f9aa5454b25"
          UNIQUE ("name")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "specializations";
    `);
  }
}
