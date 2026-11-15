import { PartialType } from '@nestjs/mapped-types';
import { CreateDiagnosticCenterDto } from './create-diagnostic-center.dto.js';

export class UpdateDiagnosticCenterDto extends PartialType(
  CreateDiagnosticCenterDto,
) {}