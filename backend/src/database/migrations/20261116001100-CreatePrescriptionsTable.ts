import { MigrationInterface, QueryRunner } from 'typeorm';

// One prescription per completed appointment, with its PDF path
export class CreatePrescriptionsTable20261116001100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "prescriptions" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "appointment_id" UUID NOT NULL,
        "patient_id" UUID NOT NULL,
        "doctor_id" UUID NOT NULL,
        "diagnosis" TEXT NOT NULL,
        "advice" TEXT,
        "follow_up_date" DATE,
        "pdf_path" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_097b2cc2f2b7e56825468188503"
          PRIMARY KEY ("id"),

        CONSTRAINT "REL_94491da15bc982f3435690fc96"
          UNIQUE ("appointment_id"),

        CONSTRAINT "FK_2d6a1941bd705056030c2b9e07d"
          FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_9389db557647131856661f7d7b5"
          FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_94491da15bc982f3435690fc96e"
          FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prescriptions_doctor" ON "prescriptions" ("doctor_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prescriptions_patient" ON "prescriptions" ("patient_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "prescriptions";
    `);
  }
}
