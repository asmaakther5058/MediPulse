import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { IsValidDate } from '../../../common/validators/is-valid-date.decorator.js';
import { AUDIT_ACTIONS } from '../audit.constants.js';
import type { AuditAction } from '../audit.constants.js';

// ?action=UPDATE&entityName=Appointment&actorUserId=...&from=2026-11-01&to=2026-11-30
export class AuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;

  // Appointment, Payment, User, Doctor, ...
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityName?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  // Inclusive, Asia/Dhaka calendar days
  @IsOptional()
  @IsValidDate()
  from?: string;

  @IsOptional()
  @IsValidDate()
  to?: string;
}
