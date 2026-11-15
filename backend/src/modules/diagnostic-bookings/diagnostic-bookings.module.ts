import { Module } from '@nestjs/common';

import { DiagnosticBookingsService } from './diagnostic-bookings.service.js';
import { DiagnosticBookingsController, RecommendationResponseController } from './diagnostic-bookings.controller.js';

@Module({
  controllers: [RecommendationResponseController, DiagnosticBookingsController],
  providers: [DiagnosticBookingsService],
})
export class DiagnosticBookingsModule {}
