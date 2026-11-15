import { MigrationInterface, QueryRunner } from 'typeorm';

// Accounts for all four roles (PATIENT, DOCTOR, DIAGNOSTIC_CENTER, ADMIN)
export class CreateUsersTable20261116000100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "full_name" VARCHAR(150) NOT NULL,
        "email" VARCHAR(150) NOT NULL,
        "phone" VARCHAR(20),
        "password_hash" VARCHAR(255) NOT NULL,
        "role" VARCHAR(30) NOT NULL DEFAULT 'PATIENT',
        "profile_image_url" VARCHAR(500),
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"
          UNIQUE ("email"),

        CONSTRAINT "UQ_a000cca60bcf04454e727699490"
          UNIQUE ("phone"),

        CONSTRAINT "chk_users_role"
          CHECK ("role" IN ('PATIENT', 'DOCTOR', 'DIAGNOSTIC_CENTER', 'ADMIN'))
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "users";
    `);
  }
}
