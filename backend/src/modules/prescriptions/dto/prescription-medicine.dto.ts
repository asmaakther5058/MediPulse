
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PrescriptionMedicineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  medicineName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  dosage: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  frequency: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  duration: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}
