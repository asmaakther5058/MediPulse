// Used by the TypeORM CLI and run-migrations.ts (not by the Nest app,
// which uses config/database.config.ts with autoLoadEntities).
import { DataSource } from 'typeorm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const dataSource = new DataSource({
  type: 'postgres',

  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'medipulse_db',

  // gen_random_uuid() is built into PostgreSQL 13+, no extension needed
  uuidExtension: 'pgcrypto',

  entities: [join(here, '..', 'modules', '**', 'entities', '*.entity.{ts,js}')],
  migrations: [join(here, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',

  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});

export default dataSource;
