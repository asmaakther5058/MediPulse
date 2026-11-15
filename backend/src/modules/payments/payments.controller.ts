import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Patient: start paying for a PENDING_PAYMENT appointment
  @Roles(UserRole.PATIENT)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(user.id, dto);
  }

  // Patient: simulated gateway confirmation -> PAID, appointment -> PENDING_DOCTOR
  @Roles(UserRole.PATIENT)
  @Post(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.confirmPayment(user.id, id);
  }

  @Roles(UserRole.PATIENT)
  @Get('my')
  findMyPayments(@CurrentUser() user: AuthUser) {
    return this.paymentsService.findMyPayments(user.id);
  }

  // Patient (own) or admin
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findOne(id, user);
  }
}
