import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { PatientsService } from './patients.service.js';
import { CreatePatientDto } from './dto/create-patient.dto.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // Patient: create own profile if missing
  @Roles(UserRole.PATIENT)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(user.id, dto);
  }

  // Patient: own profile (no need to know the profile id)
  @Roles(UserRole.PATIENT)
  @Get('me')
  findMyProfile(@CurrentUser() user: AuthUser) {
    return this.patientsService.findMyProfile(user.id);
  }

  @Roles(UserRole.PATIENT)
  @Patch('me')
  updateMyProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdatePatientDto) {
    return this.patientsService.updateMyProfile(user.id, dto);
  }

  // Admin: all patients
  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.patientsService.findAll();
  }

  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @Get(':id/medical-history')
  getMedicalHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.getMedicalHistory(id, user.id, user.role);
  }

  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.findOne(id, user.id, user.role);
  }

  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.patientsService.update(id, dto, user.id, user.role);
  }

  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.patientsService.remove(id, user.id, user.role);
  }
}
