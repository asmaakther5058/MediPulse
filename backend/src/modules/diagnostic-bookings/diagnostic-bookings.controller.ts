
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { DiagnosticBookingsService } from './diagnostic-bookings.service.js';

import { CreateDiagnosticBookingDto } from './dto/create-diagnostic-booking.dto.js';
import { CancelDiagnosticBookingDto } from './dto/cancel-diagnostic-booking.dto.js';
import { UpdateDiagnosticBookingStatusDto } from './dto/update-diagnostic-booking-status.dto.js';


import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

import { UserRole } from '../../common/enums/user-role.enum.js';

 

@Controller('diagnostic-bookings')
export class DiagnosticBookingsController {
  constructor(
    private readonly bookingsService: DiagnosticBookingsService,
  ) {}

  // Patient creates a diagnostic booking
  @Post()
  @Roles(UserRole.PATIENT)
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateDiagnosticBookingDto,
  ) {
    return this.bookingsService.create(user.id, dto);
  }

  // Patient views own bookings
  @Get('my')
  @Roles(UserRole.PATIENT)
  findMyBookings(
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.findForPatient(user.id);
  }

  // Diagnostic center views its own bookings
  @Get('center/my')
  @Roles(UserRole.DIAGNOSTIC_CENTER)
  findCenterBookings(
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.findForCenter(user.id);
  }

  // Admin views all bookings
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.bookingsService.findAll();
  }

  // Admin views one booking
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.findOne(id);
  }

  // Patient cancels own booking
  @Patch(':id/cancel')
  @Roles(UserRole.PATIENT)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CancelDiagnosticBookingDto,
  ) {
    return this.bookingsService.cancelByPatient(
      id,
      user.id,
      dto.cancellationReason,
    );
  }

  // Diagnostic center updates booking status
  @Patch(':id/status')
  @Roles(UserRole.DIAGNOSTIC_CENTER)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateDiagnosticBookingStatusDto,
  ) {
    return this.bookingsService.updateStatusByCenter(
      id,
      user.id,
      dto.status,
      dto.centerNote,
    );
  }
}
