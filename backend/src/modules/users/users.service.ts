import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { AdminCreateUserDto } from './dto/admin-create-user.dto.js';
import { hashPassword } from '../../common/utils/password.util.js';
import { isUniqueViolation, toSafeUser } from '../../common/utils/safe-user.util.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createByAdmin(dto: AdminCreateUserDto) {
    try {
      const user = await this.userRepository.save(
        this.userRepository.create({
          fullName: dto.fullName,
          email: dto.email.toLowerCase(),
          phone: dto.phone ?? null,
          passwordHash: await hashPassword(dto.password),
          role: dto.role,
          isActive: true,
        }),
      );

      return toSafeUser(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email or phone already exists');
      }
      throw error;
    }
  }

  async findAll() {
    const users = await this.userRepository.find({ order: { createdAt: 'DESC' } });
    return users.map(toSafeUser);
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return toSafeUser(user);
  }

  async update(id: string, dto: UpdateUserDto, requesterId: string) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (dto.isActive === false && id === requesterId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.email !== undefined) user.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) user.passwordHash = await hashPassword(dto.password);

    try {
      return toSafeUser(await this.userRepository.save(user));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email or phone already exists');
      }
      throw error;
    }
  }

  async remove(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    try {
      await this.userRepository.remove(user);
    } catch (error) {
      // FK RESTRICT: user has appointments/prescriptions etc.
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException(
          'User has related records; deactivate the account instead (isActive: false)',
        );
      }
      throw error;
    }

    return { message: `User with ID ${id} deleted successfully` };
  }
}
