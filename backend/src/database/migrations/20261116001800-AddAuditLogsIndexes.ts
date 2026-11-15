import { MigrationInterface, QueryRunner } from 'typeorm';

// Fast filtering of the admin audit log by date, entity and actor
export class AddAuditLogsIndexes20261116001800 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" ("created_at");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity_name", "entity_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" ("actor_user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "idx_audit_logs_actor";
    `);

    await queryRunner.query(`
      DROP INDEX "idx_audit_logs_entity";
    `);

    await queryRunner.query(`
      DROP INDEX "idx_audit_logs_created_at";
    `);
  }
}
