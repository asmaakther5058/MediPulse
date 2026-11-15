import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { PaymentStatus } from '../../../common/enums/payment-status.enum.js';
import { PaymentType } from '../../../common/enums/payment-type.enum.js';

export class PaymentReportQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
