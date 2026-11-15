import { Module } from '@nestjs/common';

import { PaymentReportsService } from './payment-reports.service.js';
import { PaymentReportsController } from './payment-reports.controller.js';

@Module({
  controllers: [PaymentReportsController],
  providers: [PaymentReportsService],
})
export class PaymentReportsModule {}
