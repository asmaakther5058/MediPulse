import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { DiagnosticBookingsService } from './diagnostic-bookings.service.js';
import { CreateDiagnosticBookingDto } from './dto/create-diagnostic-booking.dto.js';
import { RejectRecommendationDto } from './dto/reject-recommendation.dto.js';
import { CancelDiagnosticBookingDto } from './dto/cancel-diagnostic-booking.dto.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

// Patient answers a recommendation (the green / red buttons).
// Doctor-side routes of /test-recommendations are in that module.
@ApiTags('Test recommendations')
@ApiBearerAuth()
@Controller('test-recommendations')
export class RecommendationResponseController {
  constructor(private readonly service: DiagnosticBookingsService) {}

  // Approve: creates the booking (PENDING_PAYMENT) at the test price
  @Patch(':id/approve')
  @Roles(UserRole.PATIENT)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDiagnosticBookingDto,
  ) {
    return this.service.approve(id, user.id, dto);
  }

  // Reject: no booking, no payment
  @Patch(':id/reject')
  @Roles(UserRole.PATIENT)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RejectRecommendationDto,
  ) {
    return this.service.reject(id, user.id, dto);
  }
}

@ApiTags('Diagnostic bookings')
@ApiBearerAuth()
@Controller('diagnostic-bookings')
export class DiagnosticBookingsController {
  constructor(private readonly service: DiagnosticBookingsService) {}

  @Get('my')
  @Roles(UserRole.PATIENT)
  findMine(@CurrentUser() user: AuthUser, @Query() query: BookingQueryDto) {
    return this.service.findForPatient(user.id, query);
  }

  // Center: confirmed bookings by default; ?status= to see others
  @Get('center/my')
  @Roles(UserRole.DIAGNOSTIC_CENTER)
  findForCenter(@Query() query: BookingQueryDto) {
    return this.service.findForCenter(query);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: BookingQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.PATIENT)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelDiagnosticBookingDto,
  ) {
    return this.service.cancelByPatient(id, user.id, dto);
  }
}
