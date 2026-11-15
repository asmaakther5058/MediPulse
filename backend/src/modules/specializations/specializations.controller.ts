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

import { SpecializationsService } from './specializations.service.js';
import { CreateSpecializationDto } from './dto/create-specialization.dto.js';
import { UpdateSpecializationDto } from './dto/update-specialization.dto.js';

import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';

@Controller('specializations')
export class SpecializationsController {
  constructor(private readonly specializationsService: SpecializationsService) {}

  // Admin only
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateSpecializationDto) {
    return this.specializationsService.create(dto);
  }

  // Public: needed by the doctor sign-up form and patient search
  @Public()
  @Get()
  findAll() {
    return this.specializationsService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.specializationsService.findOne(id);
  }

  // Admin only
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSpecializationDto) {
    return this.specializationsService.update(id, dto);
  }

  // Admin only
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.specializationsService.remove(id);
  }
}
