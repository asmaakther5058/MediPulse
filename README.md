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
cp .env.example .env          # then fill in DB_PASSWORD and JWT_SECRET
npm install
createdb medipulse_db         # or create it in pgAdmin
npm run migration:run
npm run seed:admin            # creates the first ADMIN from SEED_ADMIN_* in .env
npm run start:dev
```

> The old migrations from both projects were replaced by one new migration
> (`src/database/migrations/*-MergedInitialSchema.ts`). Use a **new, empty database**:
> old data with integer IDs cannot be migrated automatically.

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
- If you change an entity, run `npm run migration:generate src/database/migrations/<Name>` in that shared PR.
- Each side builds and runs on its own. The full flow (book, pay, accept) works once both are merged.

## Main flows

**Doctor**
1. `POST /doctors/register` (public) creates the profile as `PENDING`
2. Admin approves it: `PATCH /doctors/:id/verification` `{ "verificationStatus": "APPROVED" }`
3. Doctor adds a schedule: `POST /doctor-availability` `{ "dayOfWeek": "MONDAY", "startTime": "10:00", "endTime": "12:00" }`. It is split into 20-minute slots.

**Patient booking**
1. `POST /auth/register` (public) creates the user and patient profile
2. `GET /doctors?search=&specializationId=` (public)
3. `GET /doctors/:doctorId/slots?date=YYYY-MM-DD` (public)
4. `POST /appointments` `{ availabilityId, appointmentDate }` returns `PENDING_PAYMENT`, held 30 minutes
5. `POST /payments` `{ appointmentId, paymentMethod }`, then `POST /payments/:id/confirm` (simulated gateway). The appointment becomes `PENDING_DOCTOR`
6. Doctor: `PATCH /appointments/:id/accept` or `/reject`, then `/complete`
7. Doctor: `POST /prescriptions`, `POST /test-recommendations`
8. Patient: `GET /diagnostic-centers/approved`, then `POST /diagnostic-bookings`

Appointment status flow:

```
PENDING_PAYMENT --pay--> PENDING_DOCTOR --accept--> ACCEPTED --complete--> COMPLETED
      |                        |                       |
 hold expires /             reject                  cancel
 patient cancels               |                       |
      v                        v                       v
  CANCELLED                REJECTED (refunded)   CANCELLED (refunded)
```

## Useful scripts

| Script | What it does |
|---|---|
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:generate src/database/migrations/Name` | Generate a migration after changing an entity |
| `npm run migration:show` / `migration:revert` | Inspect / undo |
| `npm run seed:admin` | Create the first admin |

## Not done yet

- Payments are **simulated** (`/payments/:id/confirm`). Replace this with a real gateway webhook.
- Diagnostic test bookings have no payment step.
- `earnings`, `notifications` and `audit_logs` tables exist, but nothing writes to them yet.
- `diagnostic-reports` (empty in both original projects) was left out.
