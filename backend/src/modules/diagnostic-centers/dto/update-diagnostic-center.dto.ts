import { PartialType } from '@nestjs/swagger';
import { CreateDiagnosticCenterDto } from './create-diagnostic-center.dto.js';

export class UpdateDiagnosticCenterDto extends PartialType(
  CreateDiagnosticCenterDto,
) {}