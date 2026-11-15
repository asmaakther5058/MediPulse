 
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Delete,
} from '@nestjs/common';

import { PrescriptionsService } from './prescriptions.service.js';

import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto.js';


import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { UserRole } from '../../common/enums/user-role.enum.js';

@Controller('prescriptions')
export class PrescriptionsController {
  constructor(
    private readonly prescriptionsService: PrescriptionsService,
  ) {}

  // Doctor creates prescription for own completed appointment
  @Post()
  @Roles(UserRole.DOCTOR)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePrescriptionDto,
  ) {
    return this.prescriptionsService.create(user.id, dto);
  }

  // Patient views own prescriptions
  @Get('my')
  @Roles(UserRole.PATIENT)
  findMyPrescriptions(@CurrentUser() user: AuthUser) {
    return this.prescriptionsService.findForPatient(user.id);
  }

  // Doctor views own prescriptions
  @Get('doctor/my')
  @Roles(UserRole.DOCTOR)
  findDoctorPrescriptions(@CurrentUser() user: AuthUser) {
    return this.prescriptionsService.findForDoctor(user.id);
  }

  // Admin views all prescriptions
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.prescriptionsService.findAll();
  }

  // Admin views a specific prescription
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.findOne(id);
  }

  // Doctor updates own prescription; Admin can update any
  @Patch(':id')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePrescriptionDto,
  ) {
    const isAdmin = user.role === UserRole.ADMIN;

    return this.prescriptionsService.update(
      id,
      user.id,
      isAdmin,
      dto,
    );
  }

  // Admin deletes a prescription
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.remove(id);
  }
}
