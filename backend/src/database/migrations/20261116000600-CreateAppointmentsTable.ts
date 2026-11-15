import { MigrationInterface, QueryRunner } from 'typeorm';

// Bookings; one live booking per slot per date (partial unique index)
export class CreateAppointmentsTable20261116000600 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "appointments" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "patient_id" UUID NOT NULL,
        "doctor_id" UUID NOT NULL,
        "availability_id" UUID NOT NULL,
        "appointment_date" DATE NOT NULL,
        "start_time" TIME NOT NULL,
        "end_time" TIME NOT NULL,
        "consultation_fee" NUMERIC(10,2) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
        "hold_expires_at" TIMESTAMPTZ,
        "patient_note" TEXT,
        "rejection_reason" TEXT,
        "cancellation_reason" TEXT,
        "cancelled_by" VARCHAR(20),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_3330f054416745deaa2cc130700"
          FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_4cf26c3f972d014df5c68d503d2"
          FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_e893bbc4b32e207367bcdbee9d3"
          FOREIGN KEY ("availability_id") REFERENCES "doctor_availabilities"("id") ON DELETE RESTRICT,

        CONSTRAINT "chk_appointments_cancelled_by"
          CHECK ("cancelled_by" IS NULL OR "cancelled_by" IN ('PATIENT', 'DOCTOR', 'SYSTEM')),

        CONSTRAINT "chk_appointments_fee"
          CHECK ("consultation_fee" >= 0),

        CONSTRAINT "chk_appointments_status"
          CHECK ("status" IN ('PENDING_PAYMENT', 'PENDING_DOCTOR', 'ACCEPTED', 'CANCELLED', 'COMPLETED'))
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_appointments_doctor" ON "appointments" ("doctor_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_appointments_patient" ON "appointments" ("patient_id");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_appointment_active_slot" ON "appointments" ("availability_id", "appointment_date") WHERE "status" <> 'CANCELLED';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "appointments";
    `);
  }
}
