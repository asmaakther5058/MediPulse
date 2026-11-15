import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Payment } from '../payments/entities/payment.entity.js';
import { Earning } from '../earnings/entities/earning.entity.js';
import { PaymentReportQueryDto } from './dto/payment-report-query.dto.js';

import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { PaymentType } from '../../common/enums/payment-type.enum.js';
import { EarningBeneficiaryRole } from '../../common/enums/earning-beneficiary-role.enum.js';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto.js';
import { formatPayment } from '../../common/utils/payment.util.js';
import { DOCTOR_SHARE_PERCENT } from '../../common/utils/earnings.util.js';

const PAYMENT_RELATIONS = {
  appointment: { patient: { user: true }, doctor: { user: true } },
  diagnosticBooking: { patient: { user: true }, recommendation: { diagnosticTest: true } },
} as const;

// Doctor/admin side of payments: earnings, revenue, admin overrides
@Injectable()
export class PaymentReportsService {
  constructor(private readonly dataSource: DataSource) {}

  private payments() {
    return this.dataSource.getRepository(Payment);
  }

  async findDoctorPayments(doctorUserId: string, query: PaginationQueryDto) {
    const { page, limit } = query;
    const [items, total] = await this.payments().findAndCount({
      where: { appointment: { doctor: { user: { id: doctorUserId } } } },
      relations: PAYMENT_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items.map(formatPayment), total, page, limit);
  }

  // Admin: every payment, filter by type (CONSULTATION / DIAGNOSTIC_TEST) and status
  async findAllPayments(query: PaymentReportQueryDto) {
    const { page, limit } = query;
    const [items, total] = await this.payments().findAndCount({
      where: {
        ...(query.type ? { paymentType: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      relations: PAYMENT_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items.map(formatPayment), total, page, limit);
  }

  // Admin: PENDING -> FAILED, PAID -> REFUNDED (earnings removed)
  async updatePaymentStatus(id: string, status: PaymentStatus.FAILED | PaymentStatus.REFUNDED) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.getRepository(Payment).findOne({ where: { id }, relations: PAYMENT_RELATIONS });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      const allowedFrom = status === PaymentStatus.FAILED ? PaymentStatus.PENDING : PaymentStatus.PAID;

      if (payment.status !== allowedFrom) {
        throw new BadRequestException(`Only a ${allowedFrom} payment can be marked ${status}`);
      }

      if (status === PaymentStatus.REFUNDED) {
        await manager.getRepository(Earning).delete({ payment: { id } });
      }

      payment.status = status;
      await manager.getRepository(Payment).save(payment);

      return { message: 'Payment status updated successfully', payment: formatPayment(payment) };
    });
  }

  private async sumEarnings(role: EarningBeneficiaryRole, userId?: string) {
    const qb = this.dataSource
      .getRepository(Earning)
      .createQueryBuilder('e')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.beneficiaryRole = :role', { role });

    if (userId) qb.andWhere('e.beneficiary_user_id = :userId', { userId });

    const row = await qb.getRawOne<{ count: string; total: string }>();
    return { count: Number(row?.count ?? 0), total: Number(row?.total ?? 0) };
  }

  private async sumPaid(type: PaymentType) {
    const row = await this.payments()
      .createQueryBuilder('p')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.status = :status', { status: PaymentStatus.PAID })
      .andWhere('p.paymentType = :type', { type })
      .getRawOne<{ count: string; total: string }>();

    return { count: Number(row?.count ?? 0), total: Number(row?.total ?? 0) };
  }

  // Doctor: 50% share of each PAID consultation (spec 4J), from the earnings records
  async getDoctorRevenue(doctorUserId: string) {
    const doctor = await this.sumEarnings(EarningBeneficiaryRole.DOCTOR, doctorUserId);
    const totalRevenue = Math.round((doctor.total * 100) / DOCTOR_SHARE_PERCENT * 100) / 100;

    return {
      currency: 'BDT',
      totalPaidPayments: doctor.count,
      totalRevenue,
      doctorShare: doctor.total,
      adminShare: Math.round((totalRevenue - doctor.total) * 100) / 100,
      sharePercentage: DOCTOR_SHARE_PERCENT,
    };
  }

  // Doctor: one row per earning, newest first
  async getDoctorEarnings(doctorUserId: string, query: PaginationQueryDto) {
    const { page, limit } = query;
    const [items, total] = await this.dataSource.getRepository(Earning).findAndCount({
      where: { beneficiaryUser: { id: doctorUserId }, beneficiaryRole: EarningBeneficiaryRole.DOCTOR },
      relations: { payment: { appointment: { patient: { user: true } } } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(
      items.map((e) => ({
        id: e.id,
        amount: e.amount,
        sharePercentage: e.sharePercentage,
        paymentId: e.payment.id,
        paymentAmount: e.payment.amount,
        paidAt: e.payment.paidAt,
        appointmentId: e.payment.appointment?.id,
        appointmentDate: e.payment.appointment?.appointmentDate,
        patientName: e.payment.appointment?.patient?.user?.fullName,
        createdAt: e.createdAt,
      })),
      total,
      page,
      limit,
    );
  }

  // Admin: platform income and the 50/50 consultation split (spec 6F)
  async getAdminRevenue() {
    const [consultations, tests, adminShare, doctorShare] = await Promise.all([
      this.sumPaid(PaymentType.CONSULTATION),
      this.sumPaid(PaymentType.DIAGNOSTIC_TEST),
      this.sumEarnings(EarningBeneficiaryRole.ADMIN),
      this.sumEarnings(EarningBeneficiaryRole.DOCTOR),
    ]);

    return {
      currency: 'BDT',
      totalPaidPayments: consultations.count + tests.count,
      totalRevenue: consultations.total + tests.total,
      consultation: {
        paidPayments: consultations.count,
        total: consultations.total,
        adminShare: adminShare.total,
        doctorShare: doctorShare.total,
      },
      diagnosticTests: {
        paidPayments: tests.count,
        total: tests.total,
        note: 'Revenue sharing for diagnostic tests is not defined yet',
      },
      doctorTotalShare: doctorShare.total,
      adminTotalShare: adminShare.total,
    };
  }
}
