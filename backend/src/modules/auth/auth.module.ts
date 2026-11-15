import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { User } from '../users/entities/user.entity.js';
import { Patient } from '../patients/entities/patient.entity.js';

import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Patient]),

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // seconds
          expiresIn: Number(configService.get<string>('JWT_EXPIRES_IN') ?? 3600),
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,

    // Every route requires a valid JWT unless marked @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // @Roles(...) is enforced on every route that declares it
    { provide: APP_GUARD, useClass: RolesGuard },
  ],

  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
