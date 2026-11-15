import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { DiagnosticCenter } from '../../modules/diagnostic-centers/entities/diagnostic-center.entity.js';
import { VerificationStatus } from '../enums/verification-status.enum.js';

// Version 1 has a single diagnostic center (spec section 2 / rule 2).
// Bookings go to it automatically.
export async function getTheDiagnosticCenter(manager: EntityManager): Promise<DiagnosticCenter> {
  const center = await manager.getRepository(DiagnosticCenter).findOne({
    where: { verificationStatus: VerificationStatus.APPROVED, user: { isActive: true } },
    relations: { user: true },
    order: { createdAt: 'ASC' },
  });

  if (!center) {
    throw new NotFoundException('The diagnostic center is not available yet');
  }

  return center;
}
