# MediPulse

Merged backend for MediPulse (patient side + doctor side), built with NestJS, TypeORM and PostgreSQL.

## What was merged

The **doctor project** is the base: its modules, tables and admin features.
On top of that, it uses the **patient project's** conventions and features:

| | Merged project |
|---|---|
| IDs | UUID everywhere (`gen_random_uuid()`) |
| Users table | `full_name`, `password_hash`, `profile_image_url`, `is_active` |
| Roles / statuses | UPPERCASE (`PATIENT`, `PENDING_PAYMENT`, `APPROVED`, ...) in `src/common/enums` |
| Passwords | `bcrypt` (12 rounds), max 72 chars |
| Auth | Global JWT + roles guards. Every route needs a login unless marked `@Public()` |
| Booking | Patient reserves a slot, pays within 30 minutes, then the doctor accepts |

## Setup

```bash
cd backend
cp .env.example .env          # fill in DB_PASSWORD, JWT_SECRET, SEED_* passwords
npm install
createdb medipulse_db         # or create it in pgAdmin
npm run migration:run         # creates all 17 tables (one migration file per table)
npm run seed:admin            # first ADMIN, from SEED_ADMIN_* in .env
npm run seed:demo             # optional demo data (doctors, patients, the center, priced tests)
npm run start:dev
```

- **Swagger UI:** http://localhost:3000/api/docs. Log in, click **Authorize**, and paste the `accessToken`.
- **Postman:** import the four `MediPulse-*-Tests` collections (patient, doctor, diagnostic center, admin) and run them after `seed:demo`.
- Prescription PDFs and test reports are saved under `UPLOAD_DIR` (default `backend/uploads`, which Git ignores).

## Team workflow (doctor side + patient side)

The code is split three ways so the two sides **never edit the same file**:

| Part | Who | What's in it |
|---|---|---|
| **Base** (shared) | pushed once to `main` | `package.json`, config, `src/common`, `src/database` (migration + seed), **all entities**, `auth`, `users`, `specializations`, `app.module.ts`, two empty feature files |
| **Doctor side** | doctor branch | `doctor-features.module.ts`, `doctors`, `doctor-availability`, `doctor-appointments`, `prescriptions`, `test-recommendations`, `diagnostic-tests`, `diagnostic-centers`, `payment-reports` |
| **Patient side** | patient branch | `patient-features.module.ts`, `patients`, `appointments` (+ slots), `payments`, `diagnostic-bookings` |

### Steps

1. **Doctor-side owner (once):** create the GitHub repo and push the base to `main`.
   ```bash
   unzip MediPulse-base.zip && cd MediPulse
   git init -b main && git add . && git commit -m "Base: shared core"
   git remote add origin https://github.com/<you>/MediPulse.git
   git push -u origin main
   ```
2. **Doctor side:** branch from `main`, unzip the doctor files on top, push, and open a PR.
   ```bash
   git checkout -b doctor
   unzip -o ../MediPulse-doctor.zip -d .      # adds/updates doctor-side files only
   git add . && git commit -m "Doctor side" && git push -u origin doctor
   ```
3. **Patient side (friend):** clone, branch from `main`, unzip the patient files on top, push, and open a PR.
   ```bash
   git clone https://github.com/<you>/MediPulse.git && cd MediPulse
   git checkout -b patient
   unzip -o ../MediPulse-patient.zip -d .
   git add . && git commit -m "Patient side" && git push -u origin patient
   ```
4. Merge both PRs into `main` in any order. There are no conflicts, because each side changes only its own files.

### Rules that keep merges conflict-free

- Register new modules only in **your side's** `*-features.module.ts`. Never touch `app.module.ts`.
- Shared files (`src/common`, entities, `package.json`, migrations) change through a **separate small PR to `main`**. Both sides then run `git pull origin main`.
- Migrations are one hand-written file per table (`20261116000100-CreateUsersTable.ts` style). If you change an entity, add a NEW file in that shared PR (e.g. `20261120000100-AddXToYTable.ts`), import it in `src/database/data-source.ts`, and never edit a migration that has already run.
- Each side builds and runs on its own. The full flow (book, pay, accept) works once both are merged.

## Main flows

**Roles:** `PATIENT`, `DOCTOR`, `DIAGNOSTIC_CENTER` (one center in this version), `ADMIN`. Every role has `GET /notifications/my`, plus a dashboard: `/patients/me/dashboard`, `/doctors/me/dashboard`, `/diagnostic-centers/me/dashboard` and `/admin/dashboard`.

**Doctor:** `POST /doctors/register` creates the profile as PENDING. The admin approves it with `PATCH /doctors/:id/verification`. The doctor then adds a schedule with `POST /doctor-availability`, which is split into 20-minute slots.

**Consultation**
1. Patient: `GET /doctors?search=` and `GET /doctors/:id/slots?date=YYYY-MM-DD`.
2. Patient: `POST /appointments` → `PENDING_PAYMENT`, slot held for 30 minutes.
3. Patient: `POST /payments`, then `POST /payments/:id/confirm` (simulated gateway) → `PENDING_DOCTOR`. 50% goes to the doctor and 50% to the admin as earnings records.
4. Doctor: `PATCH /appointments/:id/accept` → `ACCEPTED`, or `/reject` → `CANCELLED` (`cancelledBy: DOCTOR`, refunded, patient notified).
5. Doctor: `/complete` → `COMPLETED`. Then `POST /prescriptions` saves it and makes a PDF (`GET /prescriptions/:id/pdf`).

**Diagnostic test**
1. Doctor: `POST /test-recommendations` with `diagnosticTestIds: [...]` (all saved or none) → `PENDING`.
2. Patient: `PATCH /test-recommendations/:id/approve` creates a booking at the test price (`PENDING_PAYMENT`). `/reject` creates no booking and no payment.
3. Patient: `POST /payments/diagnostic`, then `POST /payments/:id/confirm` → booking `CONFIRMED`, and the center is notified.
4. Center: `GET /diagnostic-bookings/center/my`, then `POST /diagnostic-bookings/:id/complete` (multipart: `findings` and/or `file`) → `COMPLETED` with a report.
5. Patient: `GET /diagnostic-reports/my` and `/diagnostic-reports/:id/download`.

Appointment statuses: `PENDING_PAYMENT → PENDING_DOCTOR → ACCEPTED → COMPLETED`, or `CANCELLED` (by `PATIENT`, `DOCTOR` or `SYSTEM` when the hold expires).

## Useful scripts

| Script | What it does |
|---|---|
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:generate src/database/migrations/Name` | Generate a migration after changing an entity |
| `npm run migration:show` / `migration:revert` | Inspect / undo |
| `npm run seed:admin` | Create the first admin |
| `npm run seed:demo` | Demo doctors, patients, the center and priced tests |

## Not done yet

- Payments are **simulated** (`/payments/:id/confirm`). Replace this with a real gateway webhook.
- Diagnostic test revenue sharing is not defined yet (spec 9B), so test payments create no earnings records.
- Bonus items still open: audit log writing, Mailer, `.env` validation, request logger, response envelope.
