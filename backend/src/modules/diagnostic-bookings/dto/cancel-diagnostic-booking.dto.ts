
import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CancelDiagnosticBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string;
}
