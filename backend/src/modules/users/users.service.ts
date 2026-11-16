import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';

import { User } from './entities/user.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { AdminCreateUserDto } from './dto/admin-create-user.dto.js';
import { hashPassword } from '../../common/utils/password.util.js';
import { UserQueryDto } from './dto/user-query.dto.js';
import { ChangeRoleDto } from './dto/change-role.dto.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';
import { Patient } from '../patients/entities/patient.entity.js';
import { Doctor } from '../doctors/entities/doctor.entity.js';
import { DiagnosticCenter } from '../diagnostic-centers/entities/diagnostic-center.entity.js';
import { isUniqueViolation, toSafeUser } from '../../common/utils/safe-user.util.js';
import { MailService } from '../mail/mail.service.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,
    private readonly mail: MailService,
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

      this.mail.sendWelcome(user.id);

      return toSafeUser(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email or phone already exists');
      }
      throw error;
    }
  }

  // Admin: filter by role / active / name or email, paged
  async findAll(query: UserQueryDto) {
    const { page, limit } = query;
    const base = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
    const search = query.search?.trim();

    const [users, total] = await this.userRepository.findAndCount({
      where: search
        ? [
            { ...base, fullName: ILike(`%${search}%`) },
            { ...base, email: ILike(`%${search}%`) },
          ]
        : base,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(users.map(toSafeUser), total, page, limit);
  }

  // Admin: change a role. Only for accounts with no profile yet, so a
  // patient/doctor/center profile never ends up under the wrong role.
  async changeRole(id: string, dto: ChangeRoleDto, requesterId: string) {
    if (id === requesterId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const [patient, doctor, center] = await Promise.all([
      this.dataSource.getRepository(Patient).exists({ where: { user: { id } } }),
      this.dataSource.getRepository(Doctor).exists({ where: { user: { id } } }),
      this.dataSource.getRepository(DiagnosticCenter).exists({ where: { user: { id } } }),
    ]);

    if (patient || doctor || center) {
      throw new ConflictException(
        'This user already has a profile for their role; deactivate the account instead',
      );
    }

    user.role = dto.role;
    return toSafeUser(await this.userRepository.save(user));
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
