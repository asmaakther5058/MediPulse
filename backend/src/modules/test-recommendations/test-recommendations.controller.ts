import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { TestRecommendationsService } from './test-recommendations.service.js';
import { CreateTestRecommendationDto } from './dto/create-test-recommendation.dto.js';
import { RecommendationQueryDto } from './dto/recommendation-query.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

// Approve / reject by the patient: patient side (diagnostic-bookings module)
@ApiTags('Test recommendations')
@ApiBearerAuth()
@Controller('test-recommendations')
export class TestRecommendationsController {
  constructor(private readonly service: TestRecommendationsService) {}

  // Doctor: recommend one or more tests (all-or-nothing)
  @Post()
  @Roles(UserRole.DOCTOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTestRecommendationDto) {
    return this.service.create(user.id, dto);
  }

  @Get('my')
  @Roles(UserRole.PATIENT)
  findForPatient(@CurrentUser() user: AuthUser, @Query() query: RecommendationQueryDto) {
    return this.service.findForPatient(user.id, query);
  }

  @Get('doctor/my')
  @Roles(UserRole.DOCTOR)
  findForDoctor(@CurrentUser() user: AuthUser, @Query() query: RecommendationQueryDto) {
    return this.service.findForDoctor(user.id, query);
  }

  // Diagnostic center: every recommendation with patient ID and status (spec 5C)
  @Get('center')
  @Roles(UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  findForCenter(@Query() query: RecommendationQueryDto) {
    return this.service.findAll(query);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: RecommendationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }
}
