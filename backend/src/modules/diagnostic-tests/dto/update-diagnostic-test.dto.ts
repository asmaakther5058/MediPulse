
import { PartialType } from '@nestjs/swagger';
import { CreateDiagnosticTestDto } from './create-diagnostic-test.dto.js';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDiagnosticTestDto extends PartialType(
  CreateDiagnosticTestDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
