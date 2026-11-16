import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { MailService } from '../mail/mail.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { hashPassword } from '../../common/utils/password.util.js';

// How long a reset link works, and how many links one account may
// request per window (stops someone flooding a user's inbox)
const RESET_LINK_MINUTES = 30;
const MAX_REQUESTS = 3;
const REQUEST_WINDOW_MINUTES = 15;

// Same answer whether or not the email exists, so this endpoint
// cannot be used to find out who has an account
const GENERIC_MESSAGE =
  'If an account exists for this email, a password reset link has been sent.';

const INVALID_LINK = 'Invalid or expired reset link';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger('PasswordReset');

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly auditLogs: AuditLogsService,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(PasswordResetToken)
    private readonly tokenRepository: Repository<PasswordResetToken>,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto, ip: string | null) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase(), isActive: true },
    });
    if (!user) {
      return { message: GENERIC_MESSAGE };
    }

    const recent = await this.tokenRepository.count({
      where: {
        user: { id: user.id },
        createdAt: MoreThan(new Date(Date.now() - REQUEST_WINDOW_MINUTES * 60_000)),
      },
    });
    if (recent >= MAX_REQUESTS) {
      this.logger.warn(`Too many reset requests for user ${user.id}; no new link sent`);
      return { message: GENERIC_MESSAGE };
    }

    const token = randomBytes(32).toString('hex');
    await this.dataSource.transaction(async (manager) => {
      const tokens = manager.getRepository(PasswordResetToken);

      // Only the newest link works
      await tokens.update(
        { user: { id: user.id }, usedAt: IsNull() },
        { usedAt: new Date() },
      );
      await tokens.save(
        tokens.create({
          user: { id: user.id },
          tokenHash: this.hash(token),
          expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60_000),
          usedAt: null,
        }),
      );
    });

    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
    this.mail.sendPasswordReset(user.id, `${frontendUrl}/reset-password?token=${token}`, token, RESET_LINK_MINUTES);

    await this.auditLogs.record({
      actorUserId: user.id,
      action: 'CREATE /auth/forgot-password',
      entityName: 'PasswordResetToken',
      entityId: null,
      oldValues: null,
      newValues: { expiresInMinutes: RESET_LINK_MINUTES },
      ipAddress: ip,
    });

    return { message: GENERIC_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto, ip: string | null) {
    const passwordHash = await hashPassword(dto.newPassword);

    const userId = await this.dataSource.transaction(async (manager) => {
      // Mark the token used in the same statement that checks it, so the
      // same link can never be used twice, even by two requests at once
      const [rows] = (await manager.query(
        `UPDATE "password_reset_tokens"
            SET "used_at" = NOW()
          WHERE "token_hash" = $1 AND "used_at" IS NULL AND "expires_at" > NOW()
          RETURNING "user_id"`,
        [this.hash(dto.token)],
      )) as [Array<{ user_id: string }>, number];
      if (!rows?.length) {
        throw new BadRequestException(INVALID_LINK);
      }

      const users = manager.getRepository(User);
      const user = await users.findOne({ where: { id: rows[0].user_id, isActive: true } });
      if (!user) {
        throw new BadRequestException(INVALID_LINK);
      }

      user.passwordHash = passwordHash;
      user.passwordChangedAt = new Date();
      await users.save(user);

      // Any other open link for this account stops working too
      await manager.getRepository(PasswordResetToken).update(
        { user: { id: user.id }, usedAt: IsNull() },
        { usedAt: new Date() },
      );

      return user.id;
    });

    this.mail.sendPasswordChanged(userId);
    await this.auditLogs.record({
      actorUserId: userId,
      action: 'UPDATE /auth/reset-password',
      entityName: 'User',
      entityId: userId,
      oldValues: null,
      newValues: { event: 'password reset via email link' },
      ipAddress: ip,
    });

    return { message: 'Password has been reset. Please log in with your new password.' };
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
