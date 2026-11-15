
import {
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
} from 'class-validator';


export class CreateTestRecommendationDto {
  @IsUUID()
  appointmentId: string;
  @IsUUID()
  diagnosticTestId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  recommendationNote?: string;
}
