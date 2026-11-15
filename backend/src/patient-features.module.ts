// PATIENT-SIDE FEATURES
// Owned by the patient branch. Add patient-side modules here only.
// The doctor side registers its modules in doctor-features.module.ts,
// so the two branches never edit the same file.
import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class PatientFeaturesModule {}
