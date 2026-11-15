// PATIENT-SIDE FEATURES
// Owned by the patient branch. Add patient-side modules here only.
// The doctor side registers its modules in doctor-features.module.ts,
// so the two branches never edit the same file.
import { Module } from '@nestjs/common';

import { PatientsModule } from './modules/patients/patients.module.js';
import { AppointmentsModule } from './modules/appointments/appointments.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { DiagnosticBookingsModule } from './modules/diagnostic-bookings/diagnostic-bookings.module.js';

@Module({
  imports: [PatientsModule, AppointmentsModule, PaymentsModule, DiagnosticBookingsModule],
})
export class PatientFeaturesModule {}
