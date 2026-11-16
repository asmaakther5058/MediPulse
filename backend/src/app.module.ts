// SHARED: keep this file identical on both branches.
// Feature modules are registered in doctor-features.module.ts and
// patient-features.module.ts, not here.
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { databaseConfig } from './config/database.config.js';

// Shared core (base)
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { SpecializationsModule } from './modules/specializations/specializations.module.js';
import { EarningsModule } from './modules/earnings/earnings.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { MailModule } from './modules/mail/mail.module.js';

// One per side
import { DoctorFeaturesModule } from './doctor-features.module.js';
import { PatientFeaturesModule } from './patient-features.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),

    AuthModule,
    UsersModule,
    SpecializationsModule,
    EarningsModule,
    NotificationsModule,
    AuditLogsModule,
    AdminModule,
    MailModule,

    DoctorFeaturesModule,
    PatientFeaturesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
