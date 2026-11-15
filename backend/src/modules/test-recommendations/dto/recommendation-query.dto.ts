import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { RecommendationStatus } from '../../../common/enums/recommendation-status.enum.js';

export class RecommendationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RecommendationStatus)
  status?: RecommendationStatus;
}
