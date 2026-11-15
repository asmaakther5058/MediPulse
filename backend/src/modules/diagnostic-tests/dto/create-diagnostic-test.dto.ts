
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateDiagnosticTestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  testName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // BDT, up to 2 decimals
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sampleType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  preparationInstructions?: string;
}
