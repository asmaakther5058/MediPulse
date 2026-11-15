import { MigrationInterface, QueryRunner } from 'typeorm';

// One row per bookable 20-minute slot on a weekday (10:00-22:00)
export class CreateDoctorAvailabilitiesTable20261116000500 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "doctor_availabilities" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "doctor_id" UUID NOT NULL,
        "day_of_week" VARCHAR(10) NOT NULL,
        "start_time" TIME NOT NULL,
        "end_time" TIME NOT NULL,
        "is_available" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_2a42931ed0fe3c6934b737c503a"
          PRIMARY KEY ("id"),

        CONSTRAINT "uq_doctor_day_start"
          UNIQUE ("doctor_id", "day_of_week", "start_time"),

        CONSTRAINT "FK_aa49ce7b9ff575a2963abcb6910"
          FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE,

        CONSTRAINT "chk_doctor_availability_day"
          CHECK ("day_of_week" IN ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')),

        CONSTRAINT "chk_doctor_availability_time"
          CHECK (
            "start_time" >= TIME '10:00'
            AND "end_time" <= TIME '22:00'
            AND "end_time" = "start_time" + INTERVAL '20 minutes'
            AND MOD(EXTRACT(EPOCH FROM ("start_time" - TIME '10:00'))::INTEGER, 1200) = 0
          )
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "doctor_availabilities";
    `);
  }
}
