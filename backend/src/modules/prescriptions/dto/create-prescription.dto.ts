 
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  IsUUID,
} from 'class-validator';

import { Type } from 'class-transformer';
import { PrescriptionMedicineDto } from './prescription-medicine.dto.js';

export class CreatePrescriptionDto {
  @IsUUID()
  appointmentId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  diagnosis: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  advice?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  medicines: PrescriptionMedicineDto[];
}
