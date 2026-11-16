import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

import { User } from '../users/entities/user.entity.js';
import { Patient } from '../patients/entities/patient.entity.js';

import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

import { UserRole } from '../../common/enums/user-role.enum.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.util.js';
import { generatePatientCode } from '../../common/utils/codes.util.js';
import { isUniqueViolation, toSafeUser } from '../../common/utils/safe-user.util.js';
import { MailService } from '../mail/mail.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly mail: MailService,
  ) {}

  // Patient self-registration: user + patient profile in one transaction
  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const user = await manager.getRepository(User).save(
          manager.getRepository(User).create({
            fullName: dto.fullName,
            email: dto.email.toLowerCase(),
            phone: dto.phone ?? null,
            passwordHash,
            role: UserRole.PATIENT,
            profileImageUrl: null,
            isActive: true,
          }),
        );

        const patient = await manager.getRepository(Patient).save(
          manager.getRepository(Patient).create({
            user,
            patientCode: generatePatientCode(),
            dateOfBirth: dto.dateOfBirth ?? null,
            gender: dto.gender ?? null,
            address: dto.address ?? null,
          }),
        );

        return { user, patient };
      });

      this.mail.sendWelcome(result.user.id);

      return {
        message: 'Patient registration successful',
        user: toSafeUser(result.user),
        patientProfile: {
          id: result.patient.id,
          patientCode: result.patient.patientCode,
        },
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email or phone number already exists',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    // Same message for unknown email and wrong password
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is not active');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      message: 'Login successful',
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: Number(process.env.JWT_EXPIRES_IN ?? 3600),
      user: toSafeUser(user),
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const patientProfile =
      user.role === UserRole.PATIENT
        ? await this.patientRepository.findOne({
            where: { user: { id: user.id } },
          })
        : null;

    return {
      user: toSafeUser(user),
      patientProfile,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.email !== undefined) user.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) user.phone = dto.phone;

    try {
      return { message: 'Profile updated', user: toSafeUser(await this.userRepository.save(user)) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email or phone already in use');
      }
      throw error;
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (await verifyPassword(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    user.passwordHash = await hashPassword(dto.newPassword);
    user.passwordChangedAt = new Date();
    await this.userRepository.save(user);
    this.mail.sendPasswordChanged(user.id);

    return { message: 'Password changed successfully. Please log in again.' };
  }
}
