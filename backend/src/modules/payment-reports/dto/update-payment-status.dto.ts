import { IsIn } from 'class-validator';
import { PaymentStatus } from '../../../common/enums/payment-status.enum.js';

// Admin overrides: PENDING -> FAILED, PAID -> REFUNDED
export class UpdatePaymentStatusDto {
  @IsIn([PaymentStatus.FAILED, PaymentStatus.REFUNDED])
  status: PaymentStatus.FAILED | PaymentStatus.REFUNDED;
}
