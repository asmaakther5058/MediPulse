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
} from '@nestjs/common';

import { DoctorsService } from './doctors.service.js';
import { CreateDoctorDto } from './dto/create-doctor.dto.js';
import { UpdateDoctorDto } from './dto/update-doctor.dto.js';
import { RegisterDoctorDto } from './dto/register-doctor.dto.js';
import { VerifyDoctorDto } from './dto/verify-doctor.dto.js';
import { DoctorQueryDto } from './dto/doctor-query.dto.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

@ApiTags('Doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  // Public: doctor sign-up (PENDING until an admin verifies)
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDoctorDto) {
    return this.doctorsService.register(dto);
  }

  // Admin: create profile for an existing DOCTOR user
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateDoctorDto) {
    return this.doctorsService.create(dto);
  }

  // Doctor: own profile, including pending/rejected
  @Roles(UserRole.DOCTOR)
  @Get('me')
  findMyProfile(@CurrentUser() user: AuthUser) {
    return this.doctorsService.findMyProfile(user.id);
  }

  // Doctor: overview counts, earnings, new requests
  @Roles(UserRole.DOCTOR)
  @Get('me/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.doctorsService.dashboard(user.id);
  }

  // Doctor: own patients (paid appointments only)
  @Roles(UserRole.DOCTOR)
  @Get('me/patients')
  myPatients(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.doctorsService.myPatients(user.id, query);
  }

  // Admin: all doctors, any verification status
  @Roles(UserRole.ADMIN)
  @Get('admin/all')
  findAllForAdmin(@Query() query: PaginationQueryDto) {
    return this.doctorsService.findAllForAdmin(query);
  }

  // Admin: approve / reject
  @Roles(UserRole.ADMIN)
  @Patch(':id/verification')
  verify(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyDoctorDto) {
    return this.doctorsService.verify(id, dto);
  }

  // Public: browse approved, active doctors (search + filter + paging)
  @Public()
  @Get()
  findAll(@Query() query: DoctorQueryDto) {
    return this.doctorsService.findAll(query);
  }

  // Public: one approved doctor
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.doctorsService.findOne(id);
  }

  // Doctor (own profile) or Admin
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.doctorsService.update(id, dto, user.id, user.role);
  }

  // Admin only
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.doctorsService.remove(id);
  }
}
