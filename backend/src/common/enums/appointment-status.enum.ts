// A doctor's rejection is CANCELLED with cancelledBy = DOCTOR (spec 4E).
export enum AppointmentStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_DOCTOR = 'PENDING_DOCTOR',
  ACCEPTED = 'ACCEPTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum CancelledBy {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  SYSTEM = 'SYSTEM',
}

// Statuses that permanently occupy a slot
export const SLOT_BLOCKING_STATUSES = [
  AppointmentStatus.PENDING_DOCTOR,
  AppointmentStatus.ACCEPTED,
  AppointmentStatus.COMPLETED,
];

// How long an unpaid booking holds its slot
export const PAYMENT_HOLD_MINUTES = 30;

// Tabs on the patient and doctor dashboards (spec 3E, 4D)
export enum AppointmentCategory {
  UPCOMING = 'upcoming',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export const CATEGORY_STATUSES: Record<AppointmentCategory, AppointmentStatus[]> = {
  [AppointmentCategory.UPCOMING]: [
    AppointmentStatus.PENDING_PAYMENT,
    AppointmentStatus.PENDING_DOCTOR,
    AppointmentStatus.ACCEPTED,
  ],
  [AppointmentCategory.COMPLETED]: [AppointmentStatus.COMPLETED],
  [AppointmentCategory.CANCELLED]: [AppointmentStatus.CANCELLED],
};
