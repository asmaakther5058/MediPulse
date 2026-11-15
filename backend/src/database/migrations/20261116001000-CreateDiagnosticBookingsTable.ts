import { MigrationInterface, QueryRunner } from 'typeorm';

// Test bookings created on approval, confirmed by payment
export class CreateDiagnosticBookingsTable20261116001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "diagnostic_bookings" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "patient_id" UUID NOT NULL,
        "diagnostic_center_id" UUID NOT NULL,
        "recommendation_id" UUID NOT NULL,
        "booking_date" DATE NOT NULL,
        "booking_time" TIME,
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
        "patient_note" TEXT,
        "center_note" TEXT,
        "cancellation_reason" TEXT,
        "price" NUMERIC(10,2) NOT NULL,
        "completed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_f05f04fe085c39b696cdb4a3ede"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_0cdb9745cd9ed8e47aacb4117ea"
          FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_4070e613a985d9a68b43aa63528"
          FOREIGN KEY ("diagnostic_center_id") REFERENCES "diagnostic_center_profiles"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_6b6055a84d2bfccd17c22cfff78"
          FOREIGN KEY ("recommendation_id") REFERENCES "test_recommendations"("id") ON DELETE RESTRICT,

        CONSTRAINT "chk_booking_price"
          CHECK ("price" >= 0),

        CONSTRAINT "chk_booking_status"
          CHECK ("status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'))
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_bookings_center" ON "diagnostic_bookings" ("diagnostic_center_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_bookings_patient" ON "diagnostic_bookings" ("patient_id");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_booking_active_recommendation" ON "diagnostic_bookings" ("recommendation_id") WHERE "status" <> 'CANCELLED';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "diagnostic_bookings";
    `);
  }
}
