import { MigrationInterface, QueryRunner } from 'typeorm';

// 50/50 doctor/admin share of each paid consultation
export class CreateEarningsTable20261116001400 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "earnings" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "payment_id" UUID NOT NULL,
        "beneficiary_user_id" UUID NOT NULL,
        "beneficiary_role" VARCHAR(20) NOT NULL,
        "amount" NUMERIC(10,2) NOT NULL,
        "share_percentage" NUMERIC(5,2) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_32821f77c2546a1d53f674fe83f"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_54ff75140e583ab8c307119a7c3"
          UNIQUE ("payment_id", "beneficiary_role"),

        CONSTRAINT "FK_4fa9fb436ad0a947bd2a6df77ee"
          FOREIGN KEY ("beneficiary_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_5f1eb8dd7699a36268ae226b1e1"
          FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT,

        CONSTRAINT "chk_earnings_role"
          CHECK ("beneficiary_role" IN ('DOCTOR', 'ADMIN'))
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "earnings";
    `);
  }
}
