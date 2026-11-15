import { MigrationInterface, QueryRunner } from 'typeorm';

// Who changed what and when
export class CreateAuditLogsTable20261116001600 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "entity_id" UUID,
        "actor_user_id" UUID,
        "action" VARCHAR(100) NOT NULL,
        "entity_name" VARCHAR(100) NOT NULL,
        "old_values" JSONB,
        "new_values" JSONB,
        "ip_address" INET,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_1bb179d048bbc581caa3b013439"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_f160d97a931844109de9d04228f"
          FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "audit_logs";
    `);
  }
}
