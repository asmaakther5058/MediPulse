// DOCTOR-SIDE FEATURES
// Owned by the doctor branch. Add doctor-side modules here only.
// The patient side registers its modules in patient-features.module.ts,
// so the two branches never edit the same file.
import { Module } from '@nestjs/common';

import { DoctorsModule } from './modules/doctors/doctors.module.js';
import { DoctorAvailabilityModule } from './modules/doctor-availability/doctor-availability.module.js';
import { DoctorAppointmentsModule } from './modules/doctor-appointments/doctor-appointments.module.js';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module.js';
import { TestRecommendationsModule } from './modules/test-recommendations/test-recommendations.module.js';
import { DiagnosticTestsModule } from './modules/diagnostic-tests/diagnostic-tests.module.js';
import { DiagnosticCentersModule } from './modules/diagnostic-centers/diagnostic-centers.module.js';
import { DiagnosticReportsModule } from './modules/diagnostic-reports/diagnostic-reports.module.js';
import { PaymentReportsModule } from './modules/payment-reports/payment-reports.module.js';

@Module({
  imports: [
    DoctorsModule,
    DoctorAvailabilityModule,
    DoctorAppointmentsModule,
    PrescriptionsModule,
    TestRecommendationsModule,
    DiagnosticTestsModule,
    DiagnosticCentersModule,
    PaymentReportsModule,
    DiagnosticReportsModule,
  ],
})
export class DoctorFeaturesModule {}
