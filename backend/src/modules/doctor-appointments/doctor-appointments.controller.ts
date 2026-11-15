import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';

import { DoctorAppointmentsService } from './doctor-appointments.service.js';
import { RejectAppointmentDto } from './dto/reject-appointment.dto.js';
import { AppointmentQueryDto } from '../../common/dto/appointment-query.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

// Doctor side of /appointments. Patient routes are in the appointments module.
@Controller('appointments')
@Roles(UserRole.DOCTOR)
export class DoctorAppointmentsController {
  constructor(private readonly service: DoctorAppointmentsService) {}

  @Get('doctor/my')
  findDoctorAppointments(@CurrentUser() user: AuthUser, @Query() query: AppointmentQueryDto) {
    return this.service.findDoctorAppointments(user.id, query);
  }

  // PENDING_DOCTOR -> ACCEPTED
  @Patch(':id/accept')
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.accept(id, user.id);
  }

  // PENDING_DOCTOR -> REJECTED (payment is refunded)
  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RejectAppointmentDto,
  ) {
    return this.service.reject(id, user.id, dto);
  }

  // ACCEPTED -> COMPLETED
  @Patch(':id/complete')
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.complete(id, user.id);
  }
}
