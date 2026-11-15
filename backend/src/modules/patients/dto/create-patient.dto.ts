import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Gender } from '../../../common/enums/gender.enum.js';
import { BLOOD_GROUPS } from '../../../common/enums/blood-group.enum.js';


export class CreatePatientDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfBirth must be in YYYY-MM-DD format',
  })
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
