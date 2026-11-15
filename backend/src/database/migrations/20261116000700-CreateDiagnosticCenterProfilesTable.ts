import { MigrationInterface, QueryRunner } from 'typeorm';

// The diagnostic center profile (one center in this version)
export class CreateDiagnosticCenterProfilesTable20261116000700 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "diagnostic_center_profiles" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "center_name" VARCHAR(150) NOT NULL,
        "license_number" VARCHAR(100) NOT NULL,
        "address" TEXT NOT NULL,
        "city" VARCHAR(100) NOT NULL,
        "area" VARCHAR(100),
        "contact_number" VARCHAR(20) NOT NULL,
        "description" TEXT,
        "verification_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_5cdeca4a0e7dbfd4d76b71c8448"
          PRIMARY KEY ("id"),

        CONSTRAINT "REL_f3b9f9e20b55ad28d336ef81f4"
          UNIQUE ("user_id"),

        CONSTRAINT "UQ_8b99dfb70d686efaf4b6f837f6a"
          UNIQUE ("license_number"),

        CONSTRAINT "FK_f3b9f9e20b55ad28d336ef81f41"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,

        CONSTRAINT "chk_diagnostic_center_verification"
          CHECK ("verification_status" IN ('PENDING', 'APPROVED', 'REJECTED'))
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "diagnostic_center_profiles";
    `);
  }
}
