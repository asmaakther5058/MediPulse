import { IsIn, IsUUID } from 'class-validator';
import { PAYMENT_METHODS } from './create-payment.dto.js';

// Pay for an approved diagnostic test (spec 9B). The amount comes from
// the booking (the test price at approval), never from the client.
export class CreateDiagnosticPaymentDto {
  @IsUUID()
  diagnosticBookingId: string;

  @IsIn(PAYMENT_METHODS)
  paymentMethod: (typeof PAYMENT_METHODS)[number];
}
