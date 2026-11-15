
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';

import { DiagnosticTestsService } from './diagnostic-tests.service.js';
import { CreateDiagnosticTestDto } from './dto/create-diagnostic-test.dto.js';
import { UpdateDiagnosticTestDto } from './dto/update-diagnostic-test.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';

@Controller('diagnostic-tests')
export class DiagnosticTestsController {
  constructor(
    private readonly diagnosticTestsService: DiagnosticTestsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createDto: CreateDiagnosticTestDto) {
    return this.diagnosticTestsService.create(createDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.diagnosticTestsService.findAll();
  }

  @Get('active')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  findActive() {
    return this.diagnosticTestsService.findActive();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.diagnosticTestsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDiagnosticTestDto,
  ) {
    return this.diagnosticTestsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.diagnosticTestsService.remove(id);
  }
}
