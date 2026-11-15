import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Doctor } from './entities/doctor.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Specialization } from '../specializations/entities/specialization.entity.js';

import { DoctorsService } from './doctors.service.js';
import { DoctorsController } from './doctors.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Doctor, User, Specialization])],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [TypeOrmModule],
})
export class DoctorsModule {}
