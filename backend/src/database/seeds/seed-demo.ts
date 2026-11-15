// Demo data for the live demo: specializations, priced tests, the
// diagnostic center, 2 approved doctors with schedules and 2 patients.
// Safe to run twice (skips what exists). Refuses to run in production.
//   SEED_DEMO_PASSWORD=Demo@12345 npm run seed:demo
import dataSource from '../data-source.js';
import { User } from '../../modules/users/entities/user.entity.js';
import { Specialization } from '../../modules/specializations/entities/specialization.entity.js';
import { Doctor } from '../../modules/doctors/entities/doctor.entity.js';
import { DoctorAvailability } from '../../modules/doctor-availability/entities/doctor-availability.entity.js';
import { Patient } from '../../modules/patients/entities/patient.entity.js';
import { DiagnosticTest } from '../../modules/diagnostic-tests/entities/diagnostic-test.entity.js';
import { DiagnosticCenter } from '../../modules/diagnostic-centers/entities/diagnostic-center.entity.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { VerificationStatus } from '../../common/enums/verification-status.enum.js';
import { DayOfWeek } from '../../common/enums/day-of-week.enum.js';
import { Gender } from '../../common/enums/gender.enum.js';
import { hashPassword } from '../../common/utils/password.util.js';
import { generatePatientCode } from '../../common/utils/codes.util.js';

const SPECIALIZATIONS = [
  'Cardiology',
  'General Medicine',
  'Pediatrics',
  'Dermatology',
  'Orthopedics',
];

const TESTS: [string, string, number, string | null][] = [
  ['Complete Blood Count (CBC)', 'Blood', 500, null],
  ['Blood Glucose (Fasting)', 'Blood', 200, 'Fast for 8 hours'],
  ['Lipid Profile', 'Blood', 1200, 'Fast for 10-12 hours'],
  ['Liver Function Test (LFT)', 'Blood', 1000, null],
  ['Kidney Function Test (KFT)', 'Blood', 1000, null],
  ['Thyroid Function Test (TSH)', 'Blood', 900, null],
  ['Urine R/E', 'Urine', 300, 'Morning sample'],
  ['HbA1c', 'Blood', 1100, null],
  ['ECG', 'Cardiac', 600, null],
];

const WEEKDAYS = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.SATURDAY,
];

async function seedDemo() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:demo is for development only');
  }

  const password = process.env.SEED_DEMO_PASSWORD;

  if (!password || password.length < 8) {
    throw new Error(
      'Set SEED_DEMO_PASSWORD (min 8 chars); every demo account uses it',
    );
  }

  await dataSource.initialize();

  try {
    await dataSource.transaction(async (m) => {
      const hash = await hashPassword(password);

      const user = async (
        fullName: string,
        email: string,
        role: UserRole,
        phone: string,
      ) => {
        const existing = await m
          .getRepository(User)
          .findOne({ where: { email } });
        return (
          existing ??
          m
            .getRepository(User)
            .save(
              m
                .getRepository(User)
                .create({
                  fullName,
                  email,
                  phone,
                  role,
                  passwordHash: hash,
                  isActive: true,
                }),
            )
        );
      };

      const specs: Record<string, Specialization> = {};
      for (const name of SPECIALIZATIONS) {
        specs[name] =
          (await m
            .getRepository(Specialization)
            .findOne({ where: { name } })) ??
          (await m
            .getRepository(Specialization)
            .save(m.getRepository(Specialization).create({ name })));
      }

      for (const [
        testName,
        category,
        price,
        preparationInstructions,
      ] of TESTS) {
        if (
          !(await m
            .getRepository(DiagnosticTest)
            .exists({ where: { testName } }))
        ) {
          await m
            .getRepository(DiagnosticTest)
            .save(
              m
                .getRepository(DiagnosticTest)
                .create({
                  testName,
                  category,
                  price: String(price),
                  preparationInstructions,
                }),
            );
        }
      }

      const labUser = await user(
        'MediPulse Diagnostic Centre',
        'lab@demo.medipulse',
        UserRole.DIAGNOSTIC_CENTER,
        '01700000001',
      );
      if ((await m.getRepository(DiagnosticCenter).count()) === 0) {
        await m.getRepository(DiagnosticCenter).save(
          m.getRepository(DiagnosticCenter).create({
            user: labUser,
            centerName: 'MediPulse Diagnostic Centre',
            licenseNumber: 'DGHS-DEMO-0001',
            address: 'House 12, Road 5, Dhanmondi',
            city: 'Dhaka',
            area: 'Dhanmondi',
            contactNumber: '029660000',
            verificationStatus: VerificationStatus.APPROVED,
          }),
        );
      }

      const doctors: [string, string, string, string, number, string][] = [
        [
          'Dr. Farhana Rahman',
          'farhana@demo.medipulse',
          'Cardiology',
          'MBBS, FCPS (Cardiology)',
          1000,
          '01711000001',
        ],
        [
          'Dr. Tanvir Hasan',
          'tanvir@demo.medipulse',
          'General Medicine',
          'MBBS, MD (Medicine)',
          700,
          '01711000002',
        ],
      ];

      for (const [name, email, spec, qualifications, fee, phone] of doctors) {
        const u = await user(name, email, UserRole.DOCTOR, phone);
        if (
          await m
            .getRepository(Doctor)
            .exists({ where: { user: { id: u.id } } })
        )
          continue;

        const doctor = await m.getRepository(Doctor).save(
          m.getRepository(Doctor).create({
            user: u,
            specialization: specs[spec],
            qualifications,
            experienceYears: 8,
            consultationFee: String(fee),
            professionalInfo: `${spec} consultant`,
            verificationStatus: VerificationStatus.APPROVED,
          }),
        );

        const slots: DoctorAvailability[] = [];
        for (const day of WEEKDAYS) {
          for (let t = 10 * 60; t < 13 * 60; t += 20) {
            const time = (x: number) =>
              `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}:00`;
            slots.push(
              m
                .getRepository(DoctorAvailability)
                .create({
                  doctor,
                  dayOfWeek: day,
                  startTime: time(t),
                  endTime: time(t + 20),
                }),
            );
          }
        }
        await m.getRepository(DoctorAvailability).save(slots);
      }

      const patients: [string, string, Gender, string][] = [
        ['Ayesha Khan', 'ayesha@demo.medipulse', Gender.FEMALE, '01811000001'],
        ['Karim Uddin', 'karim@demo.medipulse', Gender.MALE, '01811000002'],
      ];

      for (const [name, email, gender, phone] of patients) {
        const u = await user(name, email, UserRole.PATIENT, phone);
        if (
          !(await m
            .getRepository(Patient)
            .exists({ where: { user: { id: u.id } } }))
        ) {
          await m
            .getRepository(Patient)
            .save(
              m
                .getRepository(Patient)
                .create({
                  user: u,
                  patientCode: generatePatientCode(),
                  gender,
                  address: 'Dhaka',
                }),
            );
        }
      }
    });

    console.log('Demo data ready. Accounts (password = SEED_DEMO_PASSWORD):');
    console.log('  Doctors:  farhana@demo.medipulse, tanvir@demo.medipulse');
    console.log('  Patients: ayesha@demo.medipulse, karim@demo.medipulse');
    console.log('  Center:   lab@demo.medipulse');
  } finally {
    await dataSource.destroy();
  }
}

seedDemo().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
