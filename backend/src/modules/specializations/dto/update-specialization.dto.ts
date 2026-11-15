 
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSpecializationDto } from './create-specialization.dto.js';

export class UpdateSpecializationDto extends PartialType(
  CreateSpecializationDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
