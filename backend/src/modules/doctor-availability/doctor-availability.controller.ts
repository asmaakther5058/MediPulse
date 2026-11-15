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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

import { DoctorAvailabilityService } from './doctor-availability.service.js';
import { CreateDoctorAvailabilityDto } from './dto/create-doctor-availability.dto.js';
import { UpdateDoctorAvailabilityDto } from './dto/update-doctor-availability.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

@ApiTags('Doctor schedule')
@ApiBearerAuth()
@Controller('doctor-availability')
export class DoctorAvailabilityController {
  constructor(private readonly availabilityService: DoctorAvailabilityService) {}

  // Doctor: add a schedule block (split into 20-minute slots)
  @Roles(UserRole.DOCTOR)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDoctorAvailabilityDto) {
    return this.availabilityService.create(user.id, dto);
  }

  // Doctor: own slots. Admin: all slots.
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.availabilityService.findAll(user.id, user.role, query);
  }

  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.availabilityService.findOne(id, user.id, user.role);
  }

  // Turn one slot on/off
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorAvailabilityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.availabilityService.update(id, dto, user.id, user.role);
  }

  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.availabilityService.remove(id, user.id, user.role);
  }
}
