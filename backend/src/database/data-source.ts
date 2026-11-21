// Used by the TypeORM CLI and run-migrations.ts (not by the Nest app,
// which uses config/database.config.ts).
import { DataSource } from 'typeorm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Migrations (one per table, in the order they must run)
import { CreateUsersTable20261116000100 } from './migrations/20261116000100-CreateUsersTable.js';
import { CreateSpecializationsTable20261116000200 } from './migrations/20261116000200-CreateSpecializationsTable.js';
import { CreatePatientProfilesTable20261116000300 } from './migrations/20261116000300-CreatePatientProfilesTable.js';
import { CreateDoctorProfilesTable20261116000400 } from './migrations/20261116000400-CreateDoctorProfilesTable.js';
import { CreateDoctorAvailabilitiesTable20261116000500 } from './migrations/20261116000500-CreateDoctorAvailabilitiesTable.js';
import { CreateAppointmentsTable20261116000600 } from './migrations/20261116000600-CreateAppointmentsTable.js';
import { CreateDiagnosticCenterProfilesTable20261116000700 } from './migrations/20261116000700-CreateDiagnosticCenterProfilesTable.js';
import { CreateDiagnosticTestsTable20261116000800 } from './migrations/20261116000800-CreateDiagnosticTestsTable.js';
import { CreateTestRecommendationsTable20261116000900 } from './migrations/20261116000900-CreateTestRecommendationsTable.js';
import { CreateDiagnosticBookingsTable20261116001000 } from './migrations/20261116001000-CreateDiagnosticBookingsTable.js';
import { CreatePrescriptionsTable20261116001100 } from './migrations/20261116001100-CreatePrescriptionsTable.js';
import { CreatePrescriptionMedicinesTable20261116001200 } from './migrations/20261116001200-CreatePrescriptionMedicinesTable.js';
import { CreatePaymentsTable20261116001300 } from './migrations/20261116001300-CreatePaymentsTable.js';
import { CreateEarningsTable20261116001400 } from './migrations/20261116001400-CreateEarningsTable.js';
import { CreateNotificationsTable20261116001500 } from './migrations/20261116001500-CreateNotificationsTable.js';
import { CreateAuditLogsTable20261116001600 } from './migrations/20261116001600-CreateAuditLogsTable.js';
import { CreateDiagnosticReportsTable20261116001700 } from './migrations/20261116001700-CreateDiagnosticReportsTable.js';
import { AddAuditLogsIndexes20261116001800 } from './migrations/20261116001800-AddAuditLogsIndexes.js';
import { AddPasswordChangedAtToUsersTable20261116001900 } from './migrations/20261116001900-AddPasswordChangedAtToUsersTable.js';
import { CreatePasswordResetTokensTable20261116002000 } from './migrations/20261116002000-CreatePasswordResetTokensTable.js';
import { AddOneActiveCenterIndex20261117000100 } from './migrations/20261117000100-AddOneActiveCenterIndex.js';

const here = dirname(fileURLToPath(import.meta.url));

const dataSource = new DataSource({
  type: 'postgres',

  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'medipulse_db',

  // Enable SSL only when connecting to Neon PostgreSQL
ssl: process.env.DB_HOST?.includes('.neon.tech')
  ? { rejectUnauthorized: false }
  : false,

  // gen_random_uuid() is built into PostgreSQL 13+, no extension needed
  uuidExtension: 'pgcrypto',

  // Every entity file, so all relations resolve
  entities: [join(here, '..', 'modules', '**', 'entities', '*.entity.{ts,js}')],

  migrations: [
    CreateUsersTable20261116000100,
    CreateSpecializationsTable20261116000200,
    CreatePatientProfilesTable20261116000300,
    CreateDoctorProfilesTable20261116000400,
    CreateDoctorAvailabilitiesTable20261116000500,
    CreateAppointmentsTable20261116000600,
    CreateDiagnosticCenterProfilesTable20261116000700,
    CreateDiagnosticTestsTable20261116000800,
    CreateTestRecommendationsTable20261116000900,
    CreateDiagnosticBookingsTable20261116001000,
    CreatePrescriptionsTable20261116001100,
    CreatePrescriptionMedicinesTable20261116001200,
    CreatePaymentsTable20261116001300,
    CreateEarningsTable20261116001400,
    CreateNotificationsTable20261116001500,
    CreateAuditLogsTable20261116001600,
    CreateDiagnosticReportsTable20261116001700,
    AddAuditLogsIndexes20261116001800,
    AddPasswordChangedAtToUsersTable20261116001900,
    CreatePasswordResetTokensTable20261116002000,
    AddOneActiveCenterIndex20261117000100,
  ],
  migrationsTableName: 'migrations',

  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});

export default dataSource;
