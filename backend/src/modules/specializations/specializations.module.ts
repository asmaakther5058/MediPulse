 
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SpecializationsController } from './specializations.controller.js';
import { SpecializationsService } from './specializations.service.js';
import { Specialization } from './entities/specialization.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Specialization])],
  controllers: [SpecializationsController],
  providers: [SpecializationsService],
  exports: [TypeOrmModule, SpecializationsService],
})
export class SpecializationsModule {}
