import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Earning } from './entities/earning.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Earning])],
  exports: [TypeOrmModule],
})
export class EarningsModule {}