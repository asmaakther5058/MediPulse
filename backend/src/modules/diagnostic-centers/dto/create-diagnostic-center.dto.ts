import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateDiagnosticCenterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  centerName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  licenseNumber: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  contactNumber: string;

  @IsOptional()
  @IsString()
  description?: string;
}