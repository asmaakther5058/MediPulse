import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { DataSource } from 'typeorm';

import { User } from '../users/entities/user.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { DiagnosticReport } from '../diagnostic-reports/entities/diagnostic-report.entity.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { PaymentType } from '../../common/enums/payment-type.enum.js';
import { APP_TIME_ZONE } from '../../common/utils/date.util.js';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PATIENT]: 'patient',
  [UserRole.DOCTOR]: 'doctor',
  [UserRole.DIAGNOSTIC_CENTER]: 'diagnostic center',
  [UserRole.ADMIN]: 'administrator',
};

// Sends the app's emails. Every method is fire-and-forget: call it after the
// database change is committed; it never throws, so a mail problem can never
// fail or roll back the user's request.
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');

  constructor(
    private readonly mailer: MailerService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // Registration (patient or doctor) and accounts an admin creates
  sendWelcome(userId: string): void {
    void this.run('welcome', async () => {
      const user = await this.dataSource
        .getRepository(User)
        .findOneByOrFail({ id: userId });
      await this.send(user.email, 'Welcome to MediPulse', 'welcome', {
        name: user.fullName,
        email: user.email,
        roleLabel: ROLE_LABELS[user.role],
        isPatient: user.role === UserRole.PATIENT,
        isDoctor: user.role === UserRole.DOCTOR,
      });
    });
  }

  // Receipt after a payment is confirmed: appointment or diagnostic test
  sendPaymentReceipt(paymentId: string): void {
    void this.run('payment receipt', async () => {
      const payment = await this.dataSource
        .getRepository(Payment)
        .findOneOrFail({
          where: { id: paymentId },
          relations: {
            appointment: {
              patient: { user: true },
              doctor: { user: true, specialization: true },
            },
            diagnosticBooking: {
              patient: { user: true },
              diagnosticCenter: true,
              recommendation: { diagnosticTest: true },
            },
          },
        });

      const receipt = {
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: (payment.paymentMethod ?? '-').replace(/_/g, ' '),
        transactionId: payment.transactionId ?? '-',
        paidAt: this.dateTime(payment.paidAt),
      };

      if (
        payment.paymentType === PaymentType.CONSULTATION &&
        payment.appointment
      ) {
        const a = payment.appointment;
        await this.send(
          a.patient.user.email,
          'Appointment booked: payment received',
          'appointment-confirmed',
          {
            name: a.patient.user.fullName,
            doctorName: a.doctor.user.fullName,
            specialization: a.doctor.specialization.name,
            date: this.date(a.appointmentDate),
            time: `${a.startTime.slice(0, 5)} - ${a.endTime.slice(0, 5)}`,
            ...receipt,
          },
        );
        return;
      }

      const b = payment.diagnosticBooking;
      if (b) {
        await this.send(
          b.patient.user.email,
          'Test booking confirmed: payment received',
          'test-booking-confirmed',
          {
            name: b.patient.user.fullName,
            testName: b.recommendation.diagnosticTest.testName,
            centerName: b.diagnosticCenter.centerName,
            centerAddress: [
              b.diagnosticCenter.address,
              b.diagnosticCenter.area,
              b.diagnosticCenter.city,
            ]
              .filter(Boolean)
              .join(', '),
            date: this.date(b.bookingDate),
            ...receipt,
          },
        );
      }
    });
  }

  // The center finished a test. No medical details in the email: the
  // patient signs in to read or download the report.
  sendReportReady(reportId: string): void {
    void this.run('report ready', async () => {
      const report = await this.dataSource
        .getRepository(DiagnosticReport)
        .findOneOrFail({
          where: { id: reportId },
          relations: {
            booking: {
              patient: { user: true },
              diagnosticCenter: true,
              recommendation: { diagnosticTest: true },
            },
          },
        });
      const b = report.booking;
      await this.send(
        b.patient.user.email,
        'Your test report is ready',
        'report-ready',
        {
          name: b.patient.user.fullName,
          testName: b.recommendation.diagnosticTest.testName,
          centerName: b.diagnosticCenter.centerName,
          completedAt: this.dateTime(b.completedAt),
          hasFile: !!report.filePath,
        },
      );
    });
  }

  // Forgot password: one-time link. Without SMTP settings (local testing)
  // the link is printed to the server log so the flow can still be tried.
  sendPasswordReset(userId: string, resetLink: string, token: string, minutes: number): void {
    void this.run('password reset', async () => {
      const user = await this.dataSource.getRepository(User).findOneByOrFail({ id: userId });
      await this.send(user.email, 'Reset your MediPulse password', 'password-reset', {
        name: user.fullName,
        resetLink,
        token,
        minutes,
      });
      if (!this.config.get<string>('MAIL_HOST') && this.config.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(`Password reset link for ${user.email}: ${resetLink}`);
      }
    });
  }

  // Security notice after a password change or reset
  sendPasswordChanged(userId: string): void {
    void this.run('password changed', async () => {
      const user = await this.dataSource.getRepository(User).findOneByOrFail({ id: userId });
      await this.send(user.email, 'Your MediPulse password was changed', 'password-changed', {
        name: user.fullName,
        email: user.email,
        changedAt: this.dateTime(user.passwordChangedAt ?? new Date()),
      });
    });
  }

  private async send(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ) {
    const info = await this.mailer.sendMail({
      to,
      subject,
      template,
      context: {
        ...context,
        appName: 'MediPulse',
        year: new Date().getFullYear(),
      },
    });

    if (this.config.get<string>('MAIL_HOST')) {
      this.logger.log(`Sent "${subject}" to ${to}`);
    } else {
      this.logger.log(
        `MAIL_HOST not set, email not sent: "${subject}" to ${to}`,
      );
    }
    return info;
  }

  private async run(kind: string, task: () => Promise<void>) {
    try {
      await task();
    } catch (error) {
      this.logger.warn(
        `Could not send ${kind} email: ${(error as Error).message}`,
      );
    }
  }

  private date(value: string) {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
  }

  private dateTime(value: Date | null) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: APP_TIME_ZONE,
    }).format(value);
  }
}
