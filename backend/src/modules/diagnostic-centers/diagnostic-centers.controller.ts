
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { DiagnosticCentersService } from './diagnostic-centers.service.js';
import { UpdateDiagnosticCenterDto } from './dto/update-diagnostic-center.dto.js';
import { AdminCreateDiagnosticCenterDto } from './dto/admin-create-diagnostic-center.dto.js';


import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { VerifyDiagnosticCenterDto } from './dto/verify-diagnostic-center.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { UserRole } from '../../common/enums/user-role.enum.js';

@ApiTags('Diagnostic center')
@ApiBearerAuth()
@Controller('diagnostic-centers')
export class DiagnosticCentersController {
  constructor(
    private readonly diagnosticCentersService: DiagnosticCentersService,
  ) {}

  // Admin creates a diagnostic center profile
  @Post()
@Roles(UserRole.ADMIN)
create(@Body() createDto: AdminCreateDiagnosticCenterDto) {
  const { userId, ...centerData } = createDto;

  return this.diagnosticCentersService.create(
    userId,
    centerData,
  );
}

  // Admin can view all diagnostic centers
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: PaginationQueryDto) {
    return this.diagnosticCentersService.findAll(query);
  }

  // Center overview: tests, recommendations, bookings (spec 5A)
  @Get('me/dashboard')
  @Roles(UserRole.DIAGNOSTIC_CENTER)
  dashboard() {
    return this.diagnosticCentersService.dashboard();
  }

  // Public: approved centers a patient can book with
  @Public()
  @Get('approved')
  findApproved(@Query('city') city?: string) {
    return this.diagnosticCentersService.findApproved(city);
  }

  // Diagnostic center views its own profile
  @Get('me')
  @Roles(UserRole.DIAGNOSTIC_CENTER)
  getMyProfile(@CurrentUser() user: AuthUser) {
    return this.diagnosticCentersService.getMyProfile(user.id);
  }

  // Admin or owner views a specific center
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DIAGNOSTIC_CENTER)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.diagnosticCentersService.findOne(
      id,
      user.id,
      user.role,
    );
  }

  // Admin or owner updates center information
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DIAGNOSTIC_CENTER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDiagnosticCenterDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.diagnosticCentersService.update(
      id,
      updateDto,
      user.id,
      user.role,
    );
  }

  // Only admin verifies a diagnostic center
  @Patch(':id/verification')
  @Roles(UserRole.ADMIN)
  updateVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDiagnosticCenterDto,
  ) {
    return this.diagnosticCentersService.updateVerification(
      id,
      dto.verificationStatus,
    );
  }
}
