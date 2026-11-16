import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Request } from 'express';

import { DiagnosticCenter } from '../../modules/diagnostic-centers/entities/diagnostic-center.entity.js';
import { UserRole } from '../enums/user-role.enum.js';
import { VerificationStatus } from '../enums/verification-status.enum.js';
import type { AuthUser } from '../interfaces/auth-user.interface.js';

// What a diagnostic center may do before an admin approves it:
// its account, its notifications, and viewing / fixing its own profile.
const ALLOWED_BEFORE_APPROVAL = [
  /^\/auth\//,
  /^\/notifications(\/|$)/,
  /^GET \/diagnostic-centers\/me$/,
  /^PATCH \/diagnostic-centers\/:id$/,
];

// Registered after JwtAuthGuard and RolesGuard (auth.module.ts), so the user
// is already known. Only affects DIAGNOSTIC_CENTER accounts.
@Injectable()
export class ApprovedCenterGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (req.user?.role !== UserRole.DIAGNOSTIC_CENTER) return true;

    const route = `${req.method} ${req.route?.path ?? req.path}`;
    const path = req.route?.path ?? req.path;
    if (ALLOWED_BEFORE_APPROVAL.some((rule) => rule.test(route) || rule.test(path))) {
      return true;
    }

    const center = await this.dataSource.getRepository(DiagnosticCenter).findOne({
      where: { user: { id: req.user.id } },
      select: { id: true, verificationStatus: true },
    });

    if (!center) {
      throw new ForbiddenException(
        'Your diagnostic center profile is missing. Ask an admin to create it.',
      );
    }
    if (center.verificationStatus !== VerificationStatus.APPROVED) {
      throw new ForbiddenException(
        center.verificationStatus === VerificationStatus.REJECTED
          ? 'Your diagnostic center was not approved. Contact the admin.'
          : 'Your diagnostic center is not approved yet. An admin must approve it first.',
      );
    }
    return true;
  }
}
