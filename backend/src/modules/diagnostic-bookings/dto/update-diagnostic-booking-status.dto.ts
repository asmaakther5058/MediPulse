import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DiagnosticBookingStatus } from '../../../common/enums/diagnostic-booking-status.enum.js';

const CENTER_STATUSES = [
  DiagnosticBookingStatus.ACCEPTED,
  DiagnosticBookingStatus.REJECTED,
  DiagnosticBookingStatus.COMPLETED,
] as const;

export class UpdateDiagnosticBookingStatusDto {
  @IsIn(CENTER_STATUSES)
  status: (typeof CENTER_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  centerNote?: string;
}
