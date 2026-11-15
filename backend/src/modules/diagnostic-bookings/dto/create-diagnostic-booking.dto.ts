

import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreateDiagnosticBookingDto {
  @IsUUID()
  recommendationId: string;
  @IsUUID()
  diagnosticCenterId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Booking date must be in YYYY-MM-DD format',
  })
  bookingDate: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Booking time must be in HH:mm format',
  })
  bookingTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  patientNote?: string;
}
