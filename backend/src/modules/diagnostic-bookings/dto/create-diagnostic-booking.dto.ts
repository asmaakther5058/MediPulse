import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Body of PATCH /test-recommendations/:id/approve. Approving creates the
// test booking (PENDING_PAYMENT) at the single diagnostic center.
export class CreateDiagnosticBookingDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'bookingDate must be in YYYY-MM-DD format' })
  bookingDate: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'bookingTime must be in HH:mm format' })
  bookingTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  patientNote?: string;
}
