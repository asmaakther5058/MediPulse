import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';
import { SlotsService } from './slots.service.js';
import { SlotsQueryDto } from './dto/slots-query.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Doctors')
@Controller('doctors')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  // Public: which slots of an approved doctor are free on a date
  @Public()
  @Get(':doctorId/slots')
  findSlots(@Param('doctorId', ParseUUIDPipe) doctorId: string, @Query() query: SlotsQueryDto) {
    return this.slotsService.findSlotsForDate(doctorId, query.date);
  }
}
