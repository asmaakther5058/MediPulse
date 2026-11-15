import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Gender } from '../../../common/enums/gender.enum.js';
import { BLOOD_GROUPS } from '../../../common/enums/blood-group.enum.js';
import { IsValidDate } from '../../../common/validators/is-valid-date.decorator.js';

export class CreatePatientDto {
  @IsOptional()
  @IsValidDate({ past: true })
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(Object.values(Gender))
  gender?: Gender;

  @IsOptional()
  @IsIn(BLOOD_GROUPS)
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContact?: string;
}
