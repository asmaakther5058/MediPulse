import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { User } from './entities/user.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import {
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  detectPhotoType,
  readStored,
  removeStored,
  saveFile,
} from '../../common/utils/storage.util.js';
import { profilePhotoUrl } from '../../common/utils/safe-user.util.js';

export interface UploadedPhoto {
  buffer: Buffer;
  size: number;
}

@Injectable()
export class ProfilePhotoService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async upload(userId: string, file?: UploadedPhoto) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose an image file (field name "file")');
    }
    if (file.size > PHOTO_MAX_BYTES) {
      throw new PayloadTooLargeException('The photo must be 2 MB or smaller');
    }
    const type = detectPhotoType(file.buffer);
    if (!type) {
      throw new BadRequestException('Only PNG, JPG or WebP images are allowed');
    }

    const user = await this.userRepository.findOneByOrFail({ id: userId });
    const previous = user.profileImageUrl;

    user.profileImageUrl = await saveFile('profile-photos', file.buffer, PHOTO_TYPES[type]);
    await this.userRepository.save(user);
    if (previous) await removeStored(previous);

    return { message: 'Profile photo updated', profileImageUrl: profilePhotoUrl(user) };
  }

  async remove(userId: string) {
    const user = await this.userRepository.findOneByOrFail({ id: userId });
    if (!user.profileImageUrl) {
      throw new NotFoundException('You have no profile photo');
    }
    const previous = user.profileImageUrl;
    user.profileImageUrl = null;
    await this.userRepository.save(user);
    await removeStored(previous);
    return { message: 'Profile photo removed', profileImageUrl: null };
  }

  // Doctor and center photos are public (patients browse doctors before
  // logging in). A patient's or admin's photo: only that person, an admin,
  // or a doctor with a paid appointment with that patient.
  async read(targetUserId: string, requester?: AuthUser) {
    const target = await this.userRepository.findOne({ where: { id: targetUserId, isActive: true } });
    if (!target?.profileImageUrl || !(await this.canSee(target, requester))) {
      throw new NotFoundException('Photo not found');
    }

    const data = await readStored(target.profileImageUrl);
    return { data, contentType: detectPhotoType(data) ?? 'application/octet-stream' };
  }

  private async canSee(target: User, requester?: AuthUser) {
    if (target.role === UserRole.DOCTOR || target.role === UserRole.DIAGNOSTIC_CENTER) return true;
    if (!requester) return false;
    if (requester.id === target.id || requester.role === UserRole.ADMIN) return true;
    if (requester.role === UserRole.DOCTOR && target.role === UserRole.PATIENT) {
      return this.dataSource.getRepository(Appointment).exists({
        where: {
          doctor: { user: { id: requester.id } },
          patient: { user: { id: target.id } },
          status: In([AppointmentStatus.PENDING_DOCTOR, AppointmentStatus.ACCEPTED, AppointmentStatus.COMPLETED]),
        },
      });
    }
    return false;
  }
}
