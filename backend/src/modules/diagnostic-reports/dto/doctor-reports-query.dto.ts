import { IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class DoctorReportsQueryDto extends PaginationQueryDto {
  // Only this patient's reports (must be one of the doctor's own patients)
  @IsOptional()
  @IsUUID()
  patientId?: string;
}
