import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { CreateDiagnosticPaymentDto } from './dto/create-diagnostic-payment.dto.js';
import { PaymentQueryDto } from './dto/payment-query.dto.js';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Patient: start paying a consultation (appointment in PENDING_PAYMENT)
  @Post()
  @Roles(UserRole.PATIENT)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(user.id, dto);
  }

  // Patient: start paying an approved diagnostic test
  @Post('diagnostic')
  @Roles(UserRole.PATIENT)
  createDiagnostic(@CurrentUser() user: AuthUser, @Body() dto: CreateDiagnosticPaymentDto) {
    return this.paymentsService.createDiagnosticPayment(user.id, dto);
  }

  // Patient: simulated gateway confirmation (both payment types)
  @Post(':id/confirm')
  @Roles(UserRole.PATIENT)
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.confirmPayment(user.id, id);
  }

  @Get('my')
  @Roles(UserRole.PATIENT)
  findMyPayments(@CurrentUser() user: AuthUser, @Query() query: PaymentQueryDto) {
    return this.paymentsService.findMyPayments(user.id, query);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findOne(id, user);
  }
}
