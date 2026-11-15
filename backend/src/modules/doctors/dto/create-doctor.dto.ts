import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

// Admin creates a profile for an existing DOCTOR user
export class CreateDoctorDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  specializationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  qualifications: string;

  @IsInt()
  @Min(0)
  experienceYears: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  consultationFee: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  professionalInfo?: string;
}
