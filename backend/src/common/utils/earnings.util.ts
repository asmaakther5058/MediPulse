import { Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { Earning } from '../../modules/earnings/entities/earning.entity.js';
import { Payment } from '../../modules/payments/entities/payment.entity.js';
import { User } from '../../modules/users/entities/user.entity.js';
import { EarningBeneficiaryRole } from '../enums/earning-beneficiary-role.enum.js';
import { UserRole } from '../enums/user-role.enum.js';

// Consultation revenue split (spec workflow 7 / business rule 16)
export const DOCTOR_SHARE_PERCENT = 50;

const logger = new Logger('Earnings');

const round2 = (n: number) => Math.round(n * 100) / 100;

// The platform admin who receives the admin share: the oldest active admin
async function platformAdmin(manager: EntityManager) {
  return manager.getRepository(User).findOne({
    where: { role: UserRole.ADMIN, isActive: true },
    order: { createdAt: 'ASC' },
  });
}

// Records the doctor's and the admin's share of a PAID consultation payment.
// Call inside the transaction that marks the payment PAID.
// Diagnostic test revenue sharing is not defined yet (spec 9B), so it records nothing.
export async function recordConsultationEarnings(
  manager: EntityManager,
  payment: Payment,
  doctorUserId: string,
) {
  const amount = Number(payment.amount);
  const doctorAmount = round2((amount * DOCTOR_SHARE_PERCENT) / 100);
  const adminAmount = round2(amount - doctorAmount);
  const repo = manager.getRepository(Earning);

  const rows: Earning[] = [
    repo.create({
      payment,
      beneficiaryUser: { id: doctorUserId } as User,
      beneficiaryRole: EarningBeneficiaryRole.DOCTOR,
      amount: doctorAmount.toFixed(2),
      sharePercentage: DOCTOR_SHARE_PERCENT.toFixed(2),
    }),
  ];

  const admin = await platformAdmin(manager);

  if (admin) {
    rows.push(
      repo.create({
        payment,
        beneficiaryUser: admin,
        beneficiaryRole: EarningBeneficiaryRole.ADMIN,
        amount: adminAmount.toFixed(2),
        sharePercentage: (100 - DOCTOR_SHARE_PERCENT).toFixed(2),
      }),
    );
  } else {
    logger.warn(`No active admin: admin share of payment ${payment.id} was not recorded`);
  }

  await repo.save(rows);
}
