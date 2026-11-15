
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiagnosticTest } from './entities/diagnostic-test.entity.js';
import { DiagnosticTestsController } from './diagnostic-tests.controller.js';
import { DiagnosticTestsService } from './diagnostic-tests.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([DiagnosticTest])],
  controllers: [DiagnosticTestsController],
  providers: [DiagnosticTestsService],
  exports: [DiagnosticTestsService],
})
export class DiagnosticTestsModule {}
