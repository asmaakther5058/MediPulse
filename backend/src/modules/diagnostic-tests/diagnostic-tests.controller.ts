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

import { DiagnosticTestsService } from './diagnostic-tests.service.js';
import { CreateDiagnosticTestDto } from './dto/create-diagnostic-test.dto.js';
import { UpdateDiagnosticTestDto } from './dto/update-diagnostic-test.dto.js';
import { DiagnosticTestQueryDto } from './dto/diagnostic-test-query.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';

// The diagnostic center manages its tests; admin can too (spec 5B)
@ApiTags('Diagnostic tests')
@ApiBearerAuth()
@Controller('diagnostic-tests')
export class DiagnosticTestsController {
  constructor(private readonly service: DiagnosticTestsService) {}

  @Post()
  @Roles(UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  create(@Body() dto: CreateDiagnosticTestDto) {
    return this.service.create(dto);
  }

  // All tests, including inactive ones
  @Get()
  @Roles(UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  findAll(@Query() query: DiagnosticTestQueryDto) {
    return this.service.findAll(query);
  }

  // Active tests with prices: what doctors recommend and patients see
  @Get('active')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  findActive(@Query() query: DiagnosticTestQueryDto) {
    return this.service.findActive(query);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDiagnosticTestDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
