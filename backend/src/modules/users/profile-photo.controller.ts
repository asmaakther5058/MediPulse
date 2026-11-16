import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { ProfilePhotoService, type UploadedPhoto } from './profile-photo.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { PHOTO_MAX_BYTES } from '../../common/utils/storage.util.js';

@ApiTags('Profile photo')
@ApiBearerAuth()
@Controller()
export class ProfilePhotoController {
  constructor(private readonly service: ProfilePhotoService) {}

  // Any logged-in user: upload or replace own photo (PNG, JPG or WebP, max 2 MB)
  @Post('auth/profile/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PHOTO_MAX_BYTES + 1, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary', description: 'PNG, JPG or WebP, max 2 MB' } },
    },
  })
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file?: UploadedPhoto) {
    return this.service.upload(user.id, file);
  }

  // Any logged-in user: remove own photo
  @Delete('auth/profile/photo')
  remove(@CurrentUser() user: AuthUser) {
    return this.service.remove(user.id);
  }

  // The image. Doctor and center photos: anyone. Patient photos: the patient,
  // an admin or a treating doctor (send the token); others get 404.
  @OptionalAuth()
  @Get('users/:id/photo')
  async photo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Res() res: Response,
  ) {
    const { data, contentType } = await this.service.read(id, user);
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(data);
  }
}
