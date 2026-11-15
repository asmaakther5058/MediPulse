import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectRecommendationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
