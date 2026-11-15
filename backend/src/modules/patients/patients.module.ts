import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';

import { Patient } from './entities/patient.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { Prescription } from '../prescriptions/entities/prescription.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, User, Appointment, Prescription])],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService, TypeOrmModule],
})
export class PatientsModule {}
