
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiagnosticBookingsController } from './diagnostic-bookings.controller.js';
import { DiagnosticBookingsService } from './diagnostic-bookings.service.js';

import { DiagnosticBooking } from './entities/diagnostic-booking.entity.js';
import { Patient } from '../patients/entities/patient.entity.js';
import { DiagnosticCenter } from '../diagnostic-centers/entities/diagnostic-center.entity.js';
import { TestRecommendation } from '../test-recommendations/entities/test-recommendation.entity.js';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiagnosticBooking,
      Patient,
      DiagnosticCenter,
      TestRecommendation,
    ]),
  ],
  controllers: [DiagnosticBookingsController],
  providers: [DiagnosticBookingsService],
  exports: [DiagnosticBookingsService],
})
export class DiagnosticBookingsModule {}
