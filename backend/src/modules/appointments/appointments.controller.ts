import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import { AppointmentQueryDto } from '../../common/dto/appointment-query.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

// Patient side. Doctor routes (/appointments/doctor/my, /:id/accept, ...)
// are in doctor-appointments.
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // Patient: reserve a slot (PENDING_PAYMENT, held for 30 minutes)
  @Roles(UserRole.PATIENT)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user.id, dto);
  }

  @Roles(UserRole.PATIENT)
  @Get('my')
  findMyAppointments(@CurrentUser() user: AuthUser, @Query() query: AppointmentQueryDto) {
    return this.appointmentsService.findMyAppointments(user.id, query);
  }

  // Admin: all appointments
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() query: AppointmentQueryDto) {
    return this.appointmentsService.findAll(query);
  }

  // Patient / doctor of this appointment, or admin
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.appointmentsService.findOne(id, user);
  }

  // Patient: cancel own appointment (payment is refunded if paid)
  @Roles(UserRole.PATIENT)
  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancel(id, user.id, dto);
  }
}
