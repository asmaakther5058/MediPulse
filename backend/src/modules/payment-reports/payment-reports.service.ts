import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from '../payments/entities/payment.entity.js';
import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { formatPayment } from '../../common/utils/payment.util.js';

// Platform commission split used for revenue reports
const DOCTOR_SHARE = 0.5;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Doctor/admin side of payments: earnings lists, revenue, admin overrides
@Injectable()
export class PaymentReportsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async findDoctorPayments(doctorUserId: string) {
    const payments = await this.paymentRepository.find({
      where: { appointment: { doctor: { user: { id: doctorUserId } } } },
      relations: { appointment: { patient: { user: true } } },
      order: { createdAt: 'DESC' },
    });

    return payments.map(formatPayment);
  }

  async findAllPayments() {
    const payments = await this.paymentRepository.find({
      relations: { appointment: { patient: { user: true }, doctor: { user: true } } },
      order: { createdAt: 'DESC' },
    });

    return payments.map(formatPayment);
  }

  // Admin: PENDING -> FAILED, PAID -> REFUNDED
  async updatePaymentStatus(id: string, status: PaymentStatus.FAILED | PaymentStatus.REFUNDED) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: { appointment: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const allowedFrom =
      status === PaymentStatus.FAILED ? PaymentStatus.PENDING : PaymentStatus.PAID;

    if (payment.status !== allowedFrom) {
      throw new BadRequestException(`Only a ${allowedFrom} payment can be marked ${status}`);
    }

    payment.status = status;
    await this.paymentRepository.save(payment);

    return { message: 'Payment status updated successfully', payment: formatPayment(payment) };
  }

  // Sum in SQL so NUMERIC precision is kept
  private async sumPaid(doctorUserId?: string) {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.status = :status', { status: PaymentStatus.PAID });

    if (doctorUserId) {
      qb.innerJoin('payment.appointment', 'appointment')
        .innerJoin('appointment.doctor', 'doctor')
        .innerJoin('doctor.user', 'doctorUser')
        .andWhere('doctorUser.id = :doctorUserId', { doctorUserId });
    }

    const row = await qb.getRawOne<{ count: string; total: string }>();
    return { count: Number(row?.count ?? 0), total: Number(row?.total ?? 0) };
  }

  async getDoctorRevenue(doctorUserId: string) {
    const { count, total } = await this.sumPaid(doctorUserId);

    return {
      totalPaidPayments: count,
      totalRevenue: total,
      doctorShare: round2(total * DOCTOR_SHARE),
      adminShare: round2(total * (1 - DOCTOR_SHARE)),
    };
  }

  async getAdminRevenue() {
    const { count, total } = await this.sumPaid();

    return {
      totalPaidPayments: count,
      totalRevenue: total,
      doctorTotalShare: round2(total * DOCTOR_SHARE),
      adminTotalShare: round2(total * (1 - DOCTOR_SHARE)),
    };
  }
}
