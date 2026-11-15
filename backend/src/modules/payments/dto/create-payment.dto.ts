import { IsIn, IsUUID } from 'class-validator';

export const PAYMENT_METHODS = ['CARD', 'MOBILE_BANKING', 'BANK_TRANSFER'] as const;

// Amount is NOT accepted from the client; it comes from the appointment.
export class CreatePaymentDto {
  @IsUUID()
  appointmentId: string;

  @IsIn(PAYMENT_METHODS)
  paymentMethod: (typeof PAYMENT_METHODS)[number];
}
