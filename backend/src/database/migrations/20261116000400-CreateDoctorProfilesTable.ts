import { MigrationInterface, QueryRunner } from 'typeorm';

// One profile per doctor user; PENDING until an admin verifies it
export class CreateDoctorProfilesTable20261116000400 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "doctor_profiles" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "specialization_id" UUID NOT NULL,
        "qualifications" TEXT NOT NULL,
        "experience_years" INTEGER NOT NULL DEFAULT 0,
        "consultation_fee" NUMERIC(10,2) NOT NULL,
        "professional_info" TEXT,
        "verification_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_b07c128005f6a0d0135d6e7353b"
          PRIMARY KEY ("id"),

        CONSTRAINT "REL_69995f9059305ab7a9c52cdb10"
          UNIQUE ("user_id"),

        CONSTRAINT "FK_008838d4e3b3e4ae76912407aa9"
          FOREIGN KEY ("specialization_id") REFERENCES "specializations"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_69995f9059305ab7a9c52cdb10e"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,

        CONSTRAINT "chk_doctor_experience"
          CHECK ("experience_years" >= 0),

        CONSTRAINT "chk_doctor_fee"
          CHECK ("consultation_fee" >= 0),

        CONSTRAINT "chk_doctor_verification_status"
          CHECK ("verification_status" IN ('PENDING', 'APPROVED', 'REJECTED'))
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "doctor_profiles";
    `);
  }
}
