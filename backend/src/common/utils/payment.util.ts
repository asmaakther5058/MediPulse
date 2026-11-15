import { Payment } from '../../modules/payments/entities/payment.entity.js';

// Safe response shape used by payments (patient) and payment-reports (doctor/admin)
export function formatPayment(p: Payment) {
  const booking = p.diagnosticBooking;

  return {
    id: p.id,
    paymentType: p.paymentType,
    appointmentId: p.appointment?.id ?? null,
    appointmentStatus: p.appointment?.status ?? null,
    diagnosticBookingId: booking?.id ?? null,
    diagnosticBookingStatus: booking?.status ?? null,
    testName: booking?.recommendation?.diagnosticTest?.testName ?? null,
    patientName:
      p.appointment?.patient?.user?.fullName ?? booking?.patient?.user?.fullName ?? undefined,
    doctorName: p.appointment?.doctor?.user?.fullName ?? undefined,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    paymentMethod: p.paymentMethod,
    transactionId: p.transactionId,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
