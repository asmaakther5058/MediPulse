import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Public doctor sign-up; profile starts as PENDING verification
export class RegisterDoctorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

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
