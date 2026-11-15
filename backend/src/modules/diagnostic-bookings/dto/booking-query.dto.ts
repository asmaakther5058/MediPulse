import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { DiagnosticBookingStatus } from '../../../common/enums/diagnostic-booking-status.enum.js';

export class BookingQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(DiagnosticBookingStatus)
  status?: DiagnosticBookingStatus;
}
