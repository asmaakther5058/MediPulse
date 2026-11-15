
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectAppointmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejectionReason: string;
}
