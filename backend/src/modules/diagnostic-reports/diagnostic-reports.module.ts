import { Module } from '@nestjs/common';

import { DiagnosticReportsService } from './diagnostic-reports.service.js';
import { CompleteTestController, DiagnosticReportsController } from './diagnostic-reports.controller.js';

@Module({
  controllers: [CompleteTestController, DiagnosticReportsController],
  providers: [DiagnosticReportsService],
})
export class DiagnosticReportsModule {}
