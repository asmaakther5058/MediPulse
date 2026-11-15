import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PrescriptionsService } from './prescriptions.service.js';
import { PrescriptionsController } from './prescriptions.controller.js';
import { Prescription } from './entities/prescription.entity.js';
import { PrescriptionMedicine } from './entities/prescription-medicine.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Prescription, PrescriptionMedicine])],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
})
export class PrescriptionsModule {}
