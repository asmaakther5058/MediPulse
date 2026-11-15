import { MigrationInterface, QueryRunner } from 'typeorm';

// Consultation and diagnostic test payments (exactly one target each)
export class CreatePaymentsTable20261116001300 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "transaction_id" VARCHAR(150),
        "appointment_id" UUID,
        "diagnostic_booking_id" UUID,
        "amount" NUMERIC(10,2) NOT NULL,
        "currency" VARCHAR(10) NOT NULL DEFAULT 'BDT',
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "payment_method" VARCHAR(50),
        "paid_at" TIMESTAMPTZ,
        "payment_type" VARCHAR(20) NOT NULL DEFAULT 'CONSULTATION',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_3c324ca49dabde7ffc0ef64675d"
          UNIQUE ("transaction_id"),

        CONSTRAINT "FK_8c1009c1f5c1dd960606cb88bee"
          FOREIGN KEY ("diagnostic_booking_id") REFERENCES "diagnostic_bookings"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_9f49987820da519f855d04c82bd"
          FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT,

        CONSTRAINT "chk_payments_amount"
          CHECK ("amount" >= 0),

        CONSTRAINT "chk_payments_status"
          CHECK ("status" IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),

        CONSTRAINT "chk_payments_target"
          CHECK (("payment_type" = 'CONSULTATION' AND "appointment_id" IS NOT NULL AND "diagnostic_booking_id" IS NULL) OR ("payment_type" = 'DIAGNOSTIC_TEST' AND "diagnostic_booking_id" IS NOT NULL AND "appointment_id" IS NULL)),

        CONSTRAINT "chk_payments_type"
          CHECK ("payment_type" IN ('CONSULTATION', 'DIAGNOSTIC_TEST'))
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payments_appointment" ON "payments" ("appointment_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payments_diagnostic_booking" ON "payments" ("diagnostic_booking_id");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_payments_active_per_appointment" ON "payments" ("appointment_id") WHERE "status" IN ('PENDING', 'PAID') AND "appointment_id" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_payments_active_per_booking" ON "payments" ("diagnostic_booking_id") WHERE "status" IN ('PENDING', 'PAID') AND "diagnostic_booking_id" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "payments";
    `);
  }
}
