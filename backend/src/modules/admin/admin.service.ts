import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../users/entities/user.entity.js';
import { Doctor } from '../doctors/entities/doctor.entity.js';
import { Appointment } from '../appointments/entities/appointment.entity.js';
import { DiagnosticBooking } from '../diagnostic-bookings/entities/diagnostic-booking.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Earning } from '../earnings/entities/earning.entity.js';

import { UserRole } from '../../common/enums/user-role.enum.js';
import { VerificationStatus } from '../../common/enums/verification-status.enum.js';
import { AppointmentStatus, CATEGORY_STATUSES, AppointmentCategory } from '../../common/enums/appointment-status.enum.js';
import { DiagnosticBookingStatus } from '../../common/enums/diagnostic-booking-status.enum.js';
import { PaymentStatus } from '../../common/enums/payment-status.enum.js';
import { PaymentType } from '../../common/enums/payment-type.enum.js';
import { EarningBeneficiaryRole } from '../../common/enums/earning-beneficiary-role.enum.js';
import { formatPayment } from '../../common/utils/payment.util.js';
import { expireStaleHolds } from '../../common/utils/appointment.util.js';

// Platform-wide totals for the admin overview (spec 6A)
@Injectable()
export class AdminService {
  constructor(private readonly dataSource: DataSource) {}

  private async countBy<T extends object>(entity: new () => T, column: string) {
    const rows = await this.dataSource
      .getRepository(entity)
      .createQueryBuilder('e')
      .select(`e.${column}`, 'key')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`e.${column}`)
      .getRawMany<{ key: string; count: string }>();

    return Object.fromEntries(rows.map((r) => [r.key, Number(r.count)])) as Record<string, number>;
  }

  private async sumPaid(type: PaymentType) {
    const row = await this.dataSource
      .getRepository(Payment)
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.status = :status', { status: PaymentStatus.PAID })
      .andWhere('p.paymentType = :type', { type })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async sumEarnings(role: EarningBeneficiaryRole) {
    const row = await this.dataSource
      .getRepository(Earning)
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.beneficiaryRole = :role', { role })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  async dashboard() {
    await expireStaleHolds(this.dataSource.manager);

    const [roles, doctorStatus, appointmentStatus, bookingStatus] = await Promise.all([
      this.countBy(User, 'role'),
      this.countBy(Doctor, 'verificationStatus'),
      this.countBy(Appointment, 'status'),
      this.countBy(DiagnosticBooking, 'status'),
    ]);

    const sum = (statuses: string[], counts: Record<string, number>) =>
      statuses.reduce((total, s) => total + (counts[s] ?? 0), 0);

    const [consultationRevenue, diagnosticRevenue, adminEarnings, doctorEarnings, recentPayments] =
      await Promise.all([
        this.sumPaid(PaymentType.CONSULTATION),
        this.sumPaid(PaymentType.DIAGNOSTIC_TEST),
        this.sumEarnings(EarningBeneficiaryRole.ADMIN),
        this.sumEarnings(EarningBeneficiaryRole.DOCTOR),
        this.dataSource.getRepository(Payment).find({
          relations: {
            appointment: { patient: { user: true }, doctor: { user: true } },
            diagnosticBooking: { patient: { user: true }, recommendation: { diagnosticTest: true } },
          },
          order: { createdAt: 'DESC' },
          take: 5,
        }),
      ]);

    const recentAppointments = await this.dataSource.getRepository(Appointment).find({
      relations: { patient: { user: true }, doctor: { user: true } },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return {
      users: {
        patients: roles[UserRole.PATIENT] ?? 0,
        doctors: roles[UserRole.DOCTOR] ?? 0,
        diagnosticCenters: roles[UserRole.DIAGNOSTIC_CENTER] ?? 0,
        admins: roles[UserRole.ADMIN] ?? 0,
      },
      doctorsAwaitingVerification: doctorStatus[VerificationStatus.PENDING] ?? 0,
      appointments: {
        total: sum(Object.values(AppointmentStatus), appointmentStatus),
        upcoming: sum(CATEGORY_STATUSES[AppointmentCategory.UPCOMING], appointmentStatus),
        completed: appointmentStatus[AppointmentStatus.COMPLETED] ?? 0,
        cancelled: appointmentStatus[AppointmentStatus.CANCELLED] ?? 0,
      },
      diagnosticBookings: {
        total: sum(Object.values(DiagnosticBookingStatus), bookingStatus),
        confirmed: bookingStatus[DiagnosticBookingStatus.CONFIRMED] ?? 0,
        completedTests: bookingStatus[DiagnosticBookingStatus.COMPLETED] ?? 0,
      },
      revenue: {
        currency: 'BDT',
        consultationPayments: consultationRevenue,
        diagnosticTestPayments: diagnosticRevenue,
        totalPlatformIncome: consultationRevenue + diagnosticRevenue,
        adminShareOfConsultations: adminEarnings,
        doctorShareOfConsultations: doctorEarnings,
      },
      recentAppointments: recentAppointments.map((a) => ({
        id: a.id,
        patient: a.patient?.user?.fullName,
        doctor: a.doctor?.user?.fullName,
        appointmentDate: a.appointmentDate,
        status: a.status,
        createdAt: a.createdAt,
      })),
      recentPayments: recentPayments.map(formatPayment),
    };
  }
}
