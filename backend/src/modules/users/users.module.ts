 import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { User } from './entities/user.entity.js';
import { ProfilePhotoController } from './profile-photo.controller.js';
import { ProfilePhotoService } from './profile-photo.service.js';


@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController, ProfilePhotoController],
  providers: [UsersService, ProfilePhotoService],
  exports: [TypeOrmModule],
})
export class UsersModule {}