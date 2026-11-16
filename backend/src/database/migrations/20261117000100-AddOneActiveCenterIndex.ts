import { MigrationInterface, QueryRunner } from 'typeorm';

// Version 1 has one diagnostic center: at most one profile may be PENDING or
// APPROVED at a time (a REJECTED one does not count). Indexing a constant makes
// every matching row clash with any other, so the database itself refuses a
// second active center, even when two sign-ups arrive at the same moment.
export class AddOneActiveCenterIndex20261117000100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_diagnostic_centers_one_active"
        ON "diagnostic_center_profiles" ((true))
        WHERE "verification_status" <> 'REJECTED';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "uq_diagnostic_centers_one_active";
    `);
  }
}
