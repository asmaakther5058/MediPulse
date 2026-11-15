import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsValidDate } from '../../../common/validators/is-valid-date.decorator.js';

// Pick a slot from GET /doctors/:doctorId/slots?date=YYYY-MM-DD
export class CreateAppointmentDto {
  @IsUUID()
  availabilityId: string;

  @IsValidDate()
  appointmentDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  patientNote?: string;
}
