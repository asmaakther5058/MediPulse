import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Appointment } from './entities/appointment.entity.js';
import { Doctor } from '../doctors/entities/doctor.entity.js';
import { DoctorAvailability } from '../doctor-availability/entities/doctor-availability.entity.js';

import { AppointmentsService } from './appointments.service.js';
import { AppointmentsController } from './appointments.controller.js';
import { SlotsService } from './slots.service.js';
import { SlotsController } from './slots.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, Doctor, DoctorAvailability])],
  controllers: [AppointmentsController, SlotsController],
  providers: [AppointmentsService, SlotsService],
})
export class AppointmentsModule {}
