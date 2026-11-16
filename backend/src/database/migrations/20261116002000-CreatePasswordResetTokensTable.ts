import { MigrationInterface, QueryRunner } from 'typeorm';

// One row per "forgot password" request: SHA-256 hash of the emailed token,
// valid for a short time and usable once
export class CreatePasswordResetTokensTable20261116002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "token_hash" VARCHAR(64) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_91185d86d5d7557b19abbb2868b"
          UNIQUE ("token_hash"),

        CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "password_reset_tokens";
    `);
  }
}
