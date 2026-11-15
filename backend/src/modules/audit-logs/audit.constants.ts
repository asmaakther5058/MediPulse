export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// First URL segment -> table it changes. Routes not listed here are not audited.
export const AUDITED_ROUTES: Record<string, string> = {
  auth: 'users',
  users: 'users',
  specializations: 'specializations',
  doctors: 'doctor_profiles',
  'doctor-availability': 'doctor_availabilities',
  patients: 'patient_profiles',
  appointments: 'appointments',
  payments: 'payments',
  prescriptions: 'prescriptions',
  'test-recommendations': 'test_recommendations',
  'diagnostic-tests': 'diagnostic_tests',
  'diagnostic-centers': 'diagnostic_center_profiles',
  'diagnostic-bookings': 'diagnostic_bookings',
  'diagnostic-reports': 'diagnostic_reports',
};

// Requests that change nothing worth auditing (or would only add noise)
export const SKIPPED_ROUTES = new Set(['/auth/login']);

// Never written to the audit log, whatever the entity
export const SECRET_KEYS = new Set([
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'accessToken',
  'pdfPath',
  'filePath',
]);

// Changes on these keys alone are not interesting in a diff
export const IGNORED_DIFF_KEYS = new Set(['updatedAt']);
