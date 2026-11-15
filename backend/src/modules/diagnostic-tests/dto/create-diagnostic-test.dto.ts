
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
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
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sampleType?: string;

  @IsOptional()
  @IsString()
  preparationInstructions?: string;
}
