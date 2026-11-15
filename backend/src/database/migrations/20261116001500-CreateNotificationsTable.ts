import { MigrationInterface, QueryRunner } from 'typeorm';

// In-app notifications for every role
export class CreateNotificationsTable20261116001500 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "related_entity_id" UUID,
        "recipient_user_id" UUID NOT NULL,
        "title" VARCHAR(150) NOT NULL,
        "message" TEXT NOT NULL,
        "notification_type" VARCHAR(50) NOT NULL,
        "related_entity_type" VARCHAR(50),
        "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_2726bde496d82b6401532ab1477"
          FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notifications_recipient_read" ON "notifications" ("recipient_user_id", "is_read");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "notifications";
    `);
  }
}
