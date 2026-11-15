 
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PrescriptionsService } from './prescriptions.service.js';
import { PrescriptionsController } from './prescriptions.controller.js';

import { Prescription } from './entities/prescription.entity.js';
import { PrescriptionMedicine } from './entities/prescription-medicine.entity.js';

import { Appointment } from '../appointments/entities/appointment.entity.js';
import { Patient } from '../patients/entities/patient.entity.js';
import { Doctor } from '../doctors/entities/doctor.entity.js';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescription,
      PrescriptionMedicine,
      Appointment,
      Patient,
      Doctor,
    ]),
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
