export enum AppointmentStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_DOCTOR = 'PENDING_DOCTOR',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

// Statuses that permanently occupy a slot
export const SLOT_BLOCKING_STATUSES = [
  AppointmentStatus.PENDING_DOCTOR,
  AppointmentStatus.ACCEPTED,
  AppointmentStatus.COMPLETED,
];

// How long an unpaid booking holds its slot
export const PAYMENT_HOLD_MINUTES = 30;
