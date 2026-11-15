import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

// Pick a slot from GET /doctors/:doctorId/slots?date=YYYY-MM-DD
export class CreateAppointmentDto {
  @IsUUID()
  availabilityId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Appointment date must be in YYYY-MM-DD format',
  })
  appointmentDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  patientNote?: string;
}
