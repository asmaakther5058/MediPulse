import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',

  host: configService.get<string>('DB_HOST'),
  port: Number(configService.get<string>('DB_PORT') ?? 5432),

  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_DATABASE'),

  // gen_random_uuid() is built into PostgreSQL 13+
  uuidExtension: 'pgcrypto',

  // Load every entity file, so relations work even when only the
  // doctor-side or only the patient-side modules are present.
  entities: [join(here, '..', 'modules', '**', 'entities', '*.entity.{ts,js}')],
  autoLoadEntities: true,

  synchronize: false,

  logging: configService.get<string>('DB_LOGGING') === 'true',
});
