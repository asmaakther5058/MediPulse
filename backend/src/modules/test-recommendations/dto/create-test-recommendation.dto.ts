import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// One or more tests for one completed appointment (spec 4I).
// All are saved together or none is (transaction with rollback).
export class CreateTestRecommendationDto {
  @IsUUID()
  appointmentId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  diagnosticTestIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  recommendationNote?: string;
}
