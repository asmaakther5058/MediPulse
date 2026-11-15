
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';

import { TestRecommendationsService } from './test-recommendations.service.js';
import { CreateTestRecommendationDto } from './dto/create-test-recommendation.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';

@Controller('test-recommendations')
export class TestRecommendationsController {
  constructor(
    private readonly testRecommendationsService: TestRecommendationsService,
  ) {}

  // Doctor creates a test recommendation
  @Post()
  @Roles(UserRole.DOCTOR)
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTestRecommendationDto,
  ) {
    return this.testRecommendationsService.create(user.id, dto);
  }

  // Patient views own recommendations
  @Get('my')
  @Roles(UserRole.PATIENT)
  findForPatient(
    @CurrentUser() user: { id: string },
  ) {
    return this.testRecommendationsService.findForPatient(user.id);
  }

  // Doctor views own recommendations
  @Get('doctor/my')
  @Roles(UserRole.DOCTOR)
  findForDoctor(
    @CurrentUser() user: { id: string },
  ) {
    return this.testRecommendationsService.findForDoctor(user.id);
  }

  // Admin views all recommendations
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.testRecommendationsService.findAll();
  }

  // Admin views a specific recommendation
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.testRecommendationsService.findOne(id);
  }
}
