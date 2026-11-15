import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsValidDate } from '../../../common/validators/is-valid-date.decorator.js';

// Body of PATCH /test-recommendations/:id/approve. Approving creates the
// test booking (PENDING_PAYMENT) at the single diagnostic center.
export class CreateDiagnosticBookingDto {
  @IsValidDate()
  bookingDate: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'bookingTime must be in HH:mm format',
  })
  bookingTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  patientNote?: string;
}
