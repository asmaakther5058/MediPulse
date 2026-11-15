// Appointment helpers shared by the patient side (booking, payment)
// and the doctor side (accept / reject / complete).
import { NotFoundException } from '@nestjs/common';
import { EntityManager, LessThanOrEqual } from 'typeorm';

import { Appointment } from '../../modules/appointments/entities/appointment.entity.js';
import { Payment } from '../../modules/payments/entities/payment.entity.js';
import { AppointmentStatus } from '../enums/appointment-status.enum.js';
import { PaymentStatus } from '../enums/payment-status.enum.js';

export const APPOINTMENT_RELATIONS = {
  patient: { user: true },
  doctor: { user: true, specialization: true },
  availability: true,
} as const;

// Unpaid bookings whose hold ran out free their slot.
// Called lazily before reads/writes (no background scheduler needed).
export async function expireStaleHolds(manager: EntityManager): Promise<void> {
  await manager.getRepository(Appointment).update(
    {
      status: AppointmentStatus.PENDING_PAYMENT,
      holdExpiresAt: LessThanOrEqual(new Date()),
    },
    {
      status: AppointmentStatus.CANCELLED,
      holdExpiresAt: null,
      cancellationReason: 'Payment hold expired',
    },
  );
}

// Lock the bare row first (FOR UPDATE can't be used with outer joins),
// then load relations. Call inside a transaction.
export async function lockAppointment(manager: EntityManager, id: string): Promise<Appointment> {
  const locked = await manager
    .getRepository(Appointment)
    .createQueryBuilder('appointment')
    .where('appointment.id = :id', { id })
    .setLock('pessimistic_write')
    .getOne();

  if (!locked) {
    throw new NotFoundException('Appointment not found');
  }

  return manager.getRepository(Appointment).findOneOrFail({
    where: { id },
    relations: APPOINTMENT_RELATIONS,
  });
}

// Paid -> refunded when a paid appointment will not happen (simulated gateway)
export async function refundPaidPayments(manager: EntityManager, appointmentId: string) {
  await manager.getRepository(Payment).update(
    { appointment: { id: appointmentId }, status: PaymentStatus.PAID },
    { status: PaymentStatus.REFUNDED },
  );
}

// Safe response shape used by both sides
export function formatAppointment(a: Appointment) {
  return {
    id: a.id,
    appointmentDate: a.appointmentDate,
    startTime: a.startTime,
    endTime: a.endTime,
    dayOfWeek: a.availability?.dayOfWeek,
    availabilityId: a.availability?.id,
    consultationFee: a.consultationFee,
    currency: 'BDT',
    status: a.status,
    holdExpiresAt: a.holdExpiresAt,
    patientNote: a.patientNote,
    rejectionReason: a.rejectionReason,
    cancellationReason: a.cancellationReason,
    patient: a.patient
      ? {
          id: a.patient.id,
          patientCode: a.patient.patientCode,
          fullName: a.patient.user?.fullName,
          email: a.patient.user?.email,
          phone: a.patient.user?.phone,
        }
      : undefined,
    doctor: a.doctor
      ? {
          id: a.doctor.id,
          fullName: a.doctor.user?.fullName,
          email: a.doctor.user?.email,
          specialization: a.doctor.specialization?.name,
        }
      : undefined,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
