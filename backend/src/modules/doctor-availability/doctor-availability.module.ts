import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DoctorAvailability } from './entities/doctor-availability.entity.js';
import { Doctor } from '../doctors/entities/doctor.entity.js';
import { DoctorAvailabilityService } from './doctor-availability.service.js';
import { DoctorAvailabilityController } from './doctor-availability.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([DoctorAvailability, Doctor])],
  controllers: [DoctorAvailabilityController],
  providers: [DoctorAvailabilityService],
})
export class DoctorAvailabilityModule {}
