import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';

import { PaymentReportsService } from './payment-reports.service.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

// Doctor/admin side of /payments. Patient routes are in the payments module.
@Controller('payments')
export class PaymentReportsController {
  constructor(private readonly service: PaymentReportsService) {}

  @Roles(UserRole.DOCTOR)
  @Get('doctor/my')
  findDoctorPayments(@CurrentUser() user: AuthUser) {
    return this.service.findDoctorPayments(user.id);
  }

  @Roles(UserRole.DOCTOR)
  @Get('revenue/doctor/my')
  getDoctorRevenue(@CurrentUser() user: AuthUser) {
    return this.service.getDoctorRevenue(user.id);
  }

  @Roles(UserRole.ADMIN)
  @Get('revenue/admin')
  getAdminRevenue() {
    return this.service.getAdminRevenue();
  }

  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.service.findAllPayments();
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePaymentStatusDto) {
    return this.service.updatePaymentStatus(id, dto.status);
  }
}
