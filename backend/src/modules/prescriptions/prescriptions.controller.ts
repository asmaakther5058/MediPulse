import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';

import { PrescriptionsService } from './prescriptions.service.js';
import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

@ApiTags('Prescriptions')
@ApiBearerAuth()
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  // Doctor: prescription for own completed appointment (PDF made, patient notified)
  @Post()
  @Roles(UserRole.DOCTOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(user.id, dto);
  }

  @Get('my')
  @Roles(UserRole.PATIENT)
  findMyPrescriptions(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.prescriptionsService.findForPatient(user.id, query);
  }

  @Get('doctor/my')
  @Roles(UserRole.DOCTOR)
  findDoctorPrescriptions(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.prescriptionsService.findForDoctor(user.id, query);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: PaginationQueryDto) {
    return this.prescriptionsService.findAll(query);
  }

  // Patient (own), doctor (own) or admin
  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.prescriptionsService.findOne(id, user);
  }

  // Download the PDF (patient own, doctor own, admin)
  @Get(':id/pdf')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)
  @ApiProduces('application/pdf')
  async pdf(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const { data, fileName } = await this.prescriptionsService.pdf(id, user);
    return new StreamableFile(data, { type: 'application/pdf', disposition: `attachment; filename="${fileName}"` });
  }

  @Patch(':id')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePrescriptionDto,
  ) {
    return this.prescriptionsService.update(id, user, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.remove(id);
  }
}
