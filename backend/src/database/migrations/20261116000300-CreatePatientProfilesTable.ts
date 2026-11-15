import { MigrationInterface, QueryRunner } from 'typeorm';

// One profile per patient user, with the unique patient code
export class CreatePatientProfilesTable20261116000300 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "patient_profiles" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "patient_code" VARCHAR(30) NOT NULL,
        "date_of_birth" DATE,
        "gender" VARCHAR(20),
        "blood_group" VARCHAR(5),
        "address" TEXT,
        "emergency_contact" VARCHAR(20),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_7297a6976f065cc75e798674aa8"
          PRIMARY KEY ("id"),

        CONSTRAINT "REL_e296010b9088277148d109ba75"
          UNIQUE ("user_id"),

        CONSTRAINT "UQ_dab8b800c515676387f7d15a216"
          UNIQUE ("patient_code"),

        CONSTRAINT "FK_e296010b9088277148d109ba75a"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,

        CONSTRAINT "chk_patient_blood_group"
          CHECK ("blood_group" IS NULL OR "blood_group" IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),

        CONSTRAINT "chk_patient_gender"
          CHECK ("gender" IS NULL OR "gender" IN ('MALE', 'FEMALE', 'OTHER'))
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "patient_profiles";
    `);
  }
}
