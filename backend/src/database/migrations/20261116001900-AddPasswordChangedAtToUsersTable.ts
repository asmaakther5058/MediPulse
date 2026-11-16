import { MigrationInterface, QueryRunner } from 'typeorm';

// When the password last changed. Login tokens issued before this
// moment stop working (password reset / change logs out old sessions).
export class AddPasswordChangedAtToUsersTable20261116001900 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD "password_changed_at" TIMESTAMPTZ;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "password_changed_at";
    `);
  }
}
