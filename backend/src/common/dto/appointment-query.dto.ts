import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto.js';
import { AppointmentCategory, AppointmentStatus } from '../enums/appointment-status.enum.js';

export class AppointmentQueryDto extends PaginationQueryDto {
  // Exact status, e.g. PENDING_DOCTOR
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  // Dashboard tab: upcoming | completed | cancelled
  @IsOptional()
  @IsEnum(AppointmentCategory)
  category?: AppointmentCategory;
}
