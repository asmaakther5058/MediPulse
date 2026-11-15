import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PaymentReportsService } from './payment-reports.service.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';
import { PaymentReportQueryDto } from './dto/payment-report-query.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

// Doctor/admin side of /payments. Patient routes are in the payments module.
@ApiTags('Earnings & revenue')
@ApiBearerAuth()
@Controller('payments')
export class PaymentReportsController {
  constructor(private readonly service: PaymentReportsService) {}

  @Roles(UserRole.DOCTOR)
  @Get('doctor/my')
  findDoctorPayments(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.service.findDoctorPayments(user.id, query);
  }

  @Roles(UserRole.DOCTOR)
  @Get('revenue/doctor/my')
  getDoctorRevenue(@CurrentUser() user: AuthUser) {
    return this.service.getDoctorRevenue(user.id);
  }

  @Roles(UserRole.DOCTOR)
  @Get('earnings/doctor/my')
  getDoctorEarnings(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.service.getDoctorEarnings(user.id, query);
  }

  @Roles(UserRole.ADMIN)
  @Get('revenue/admin')
  getAdminRevenue() {
    return this.service.getAdminRevenue();
  }

  // ?type=DIAGNOSTIC_TEST&status=PAID&page=1&limit=10
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() query: PaymentReportQueryDto) {
    return this.service.findAllPayments(query);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePaymentStatusDto) {
    return this.service.updatePaymentStatus(id, dto.status);
  }
}
