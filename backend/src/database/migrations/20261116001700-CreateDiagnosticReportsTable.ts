import { MigrationInterface, QueryRunner } from 'typeorm';

// Result of a completed test booking: findings and/or a file
export class CreateDiagnosticReportsTable20261116001700 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "diagnostic_reports" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" UUID NOT NULL,
        "uploaded_by_user_id" UUID,
        "findings" TEXT,
        "file_path" VARCHAR(255),
        "file_name" VARCHAR(255),
        "mime_type" VARCHAR(100),
        "file_size" INTEGER,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_cde1159541fdedf6e20fa48e6ec"
          PRIMARY KEY ("id"),

        CONSTRAINT "REL_037dbc6f65a29a5c5a7b85bf8a"
          UNIQUE ("booking_id"),

        CONSTRAINT "FK_037dbc6f65a29a5c5a7b85bf8ab"
          FOREIGN KEY ("booking_id") REFERENCES "diagnostic_bookings"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_f8ed93374b87c9caa3ec57173b3"
          FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,

        CONSTRAINT "chk_report_has_content"
          CHECK ("findings" IS NOT NULL OR "file_path" IS NOT NULL)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "diagnostic_reports";
    `);
  }
}
