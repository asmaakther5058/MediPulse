import { MigrationInterface, QueryRunner } from 'typeorm';

// Test catalog with prices, managed by the diagnostic center
export class CreateDiagnosticTestsTable20261116000800 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "diagnostic_tests" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "test_name" VARCHAR(150) NOT NULL,
        "category" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "sample_type" VARCHAR(100),
        "preparation_instructions" TEXT,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "price" NUMERIC(10,2) NOT NULL DEFAULT '0',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_dcf7e761d09a27870664dcc21dd"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_c9babbb198b68f970c41dcad3e2"
          UNIQUE ("test_name"),

        CONSTRAINT "chk_diagnostic_tests_price"
          CHECK ("price" >= 0)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_diagnostic_tests_category" ON "diagnostic_tests" ("category");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "diagnostic_tests";
    `);
  }
}
