import { MigrationInterface, QueryRunner } from 'typeorm';

// Medicines on a prescription
export class CreatePrescriptionMedicinesTable20261116001200 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "prescription_medicines" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "prescription_id" UUID NOT NULL,
        "medicine_name" VARCHAR(150) NOT NULL,
        "dosage" VARCHAR(100) NOT NULL,
        "frequency" VARCHAR(100) NOT NULL,
        "duration" VARCHAR(100) NOT NULL,
        "instructions" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_a3aa7e0b9a01f51047385ead5ee"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_ec23f4d56cf520bda640dfb8bf1"
          FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prescription_medicines_prescription" ON "prescription_medicines" ("prescription_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "prescription_medicines";
    `);
  }
}
