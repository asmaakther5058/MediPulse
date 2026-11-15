import { MigrationInterface, QueryRunner } from 'typeorm';

// Tests a doctor recommends; the patient approves or rejects them
export class CreateTestRecommendationsTable20261116000900 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "test_recommendations" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "patient_id" UUID NOT NULL,
        "doctor_id" UUID NOT NULL,
        "appointment_id" UUID NOT NULL,
        "diagnostic_test_id" UUID NOT NULL,
        "recommendation_note" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "responded_at" TIMESTAMPTZ,
        "rejection_reason" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_f1fc54794fa67db021b8d024a26"
          PRIMARY KEY ("id"),

        CONSTRAINT "uq_appointment_diagnostic_test"
          UNIQUE ("appointment_id", "diagnostic_test_id"),

        CONSTRAINT "FK_81deb2e878c6d27a90ff024d9e6"
          FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_8d88e71138af5b7da8b0f499a84"
          FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_bac8cebeb24cca480d9c1cd27f4"
          FOREIGN KEY ("diagnostic_test_id") REFERENCES "diagnostic_tests"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_f15e306e70586789f6dcb3c4cd4"
          FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT,

        CONSTRAINT "chk_recommendation_status"
          CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'BOOKED', 'COMPLETED'))
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_recommendations_doctor" ON "test_recommendations" ("doctor_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_recommendations_patient" ON "test_recommendations" ("patient_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "test_recommendations";
    `);
  }
}
