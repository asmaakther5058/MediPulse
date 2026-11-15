import { Module } from '@nestjs/common';

import { TestRecommendationsService } from './test-recommendations.service.js';
import { TestRecommendationsController } from './test-recommendations.controller.js';

@Module({
  controllers: [TestRecommendationsController],
  providers: [TestRecommendationsService],
})
export class TestRecommendationsModule {}
