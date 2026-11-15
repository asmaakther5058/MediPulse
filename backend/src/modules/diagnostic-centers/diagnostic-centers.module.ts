import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiagnosticCenter } from './entities/diagnostic-center.entity.js';
import { User } from '../users/entities/user.entity.js';

import { DiagnosticCentersController } from './diagnostic-centers.controller.js';
import { DiagnosticCentersService } from './diagnostic-centers.service.js';


@Module({
  imports: [
    TypeOrmModule.forFeature([DiagnosticCenter, User]),
  ],
  controllers: [DiagnosticCentersController],
  providers: [DiagnosticCentersService],
  exports: [DiagnosticCentersService],
})
export class DiagnosticCentersModule {}