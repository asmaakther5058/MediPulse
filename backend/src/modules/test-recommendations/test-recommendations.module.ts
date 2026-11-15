
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TestRecommendation } from './entities/test-recommendation.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { DiagnosticTest } from '../diagnostic-tests/entities/diagnostic-test.entity.js';

import { TestRecommendationsController } from './test-recommendations.controller.js';
import { TestRecommendationsService } from './test-recommendations.service.js';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      TestRecommendation,
      Appointment,
      DiagnosticTest,
    ]),
  ],
  controllers: [TestRecommendationsController],
  providers: [TestRecommendationsService],
  exports: [TestRecommendationsService],
})
export class TestRecommendationsModule {}
