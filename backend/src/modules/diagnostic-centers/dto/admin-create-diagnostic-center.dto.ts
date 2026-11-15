import { IsUUID } from 'class-validator';
import { CreateDiagnosticCenterDto } from './create-diagnostic-center.dto.js';

// Admin creates a center profile for an existing DIAGNOSTIC_CENTER user
export class AdminCreateDiagnosticCenterDto extends CreateDiagnosticCenterDto {
  @IsUUID()
  userId: string;
}
