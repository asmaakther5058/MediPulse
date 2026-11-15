import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Payment } from '../payments/entities/payment.entity.js';
import { PaymentReportsService } from './payment-reports.service.js';
import { PaymentReportsController } from './payment-reports.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  controllers: [PaymentReportsController],
  providers: [PaymentReportsService],
})
export class PaymentReportsModule {}
