import { Payment } from '../../modules/payments/entities/payment.entity.js';

// Safe response shape used by payments (patient) and payment-reports (doctor/admin)
export function formatPayment(p: Payment) {
  return {
    id: p.id,
    appointmentId: p.appointment?.id,
    appointmentStatus: p.appointment?.status,
    patientName: p.appointment?.patient?.user?.fullName,
    doctorName: p.appointment?.doctor?.user?.fullName,
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
