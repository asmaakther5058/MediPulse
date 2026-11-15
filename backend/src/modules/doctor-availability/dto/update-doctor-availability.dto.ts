
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDoctorAvailabilityDto {
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
