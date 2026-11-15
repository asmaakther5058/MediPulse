import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { DiagnosticReportsService, type UploadedReportFile } from './diagnostic-reports.service.js';
import { CompleteTestDto } from './dto/complete-test.dto.js';
import { UpdateReportDto } from './dto/update-report.dto.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { REPORT_MAX_BYTES } from '../../common/utils/storage.util.js';

// Files are kept in memory only long enough to check and store them.
// The +1 lets an oversize file through to be refused with a clear 400.
const upload = FileInterceptor('file', { limits: { fileSize: REPORT_MAX_BYTES + 1, files: 1 } });

const multipartBody = (extra: Record<string, object>) =>
  ApiBody({
    schema: {
      type: 'object',
      properties: { ...extra, file: { type: 'string', format: 'binary', description: 'PDF, PNG or JPEG, max 5 MB' } },
    },
  });

// Center: the "Complete Test" button (spec 5E)
@ApiTags('Diagnostic reports')
@ApiBearerAuth()
@Controller('diagnostic-bookings')
export class CompleteTestController {
  constructor(private readonly service: DiagnosticReportsService) {}

  @Post(':id/complete')
  @Roles(UserRole.DIAGNOSTIC_CENTER)
  @UseInterceptors(upload)
  @ApiConsumes('multipart/form-data')
  @multipartBody({ findings: { type: 'string' }, centerNote: { type: 'string' } })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteTestDto,
    @UploadedFile() file?: UploadedReportFile,
  ) {
    return this.service.completeTest(id, user, dto, file);
  }
}

@ApiTags('Diagnostic reports')
@ApiBearerAuth()
@Controller('diagnostic-reports')
export class DiagnosticReportsController {
  constructor(private readonly service: DiagnosticReportsService) {}

  // Patient: own reports
  @Get('my')
  @Roles(UserRole.PATIENT)
  findMine(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.service.findMine(user.id, query);
  }

  // Center and admin: every report
  @Get()
  @Roles(UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Get(':id/download')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN)
  async download(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const { data, mimeType, fileName } = await this.service.download(id, user);
    return new StreamableFile(data, { type: mimeType, disposition: `attachment; filename="${fileName}"` });
  }

  // Center: correct findings or replace the file
  @Patch(':id')
  @Roles(UserRole.DIAGNOSTIC_CENTER)
  @UseInterceptors(upload)
  @ApiConsumes('multipart/form-data')
  @multipartBody({ findings: { type: 'string' } })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
    @UploadedFile() file?: UploadedReportFile,
  ) {
    return this.service.update(id, dto, file);
  }
}
