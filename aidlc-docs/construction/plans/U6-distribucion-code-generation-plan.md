# U6 Distribución e Historial — Code Generation Plan

Builds on U0-U5. Stories US-6.1…6.5.

## Steps
### Step 1 — Schema + migration
- [x] Add `token String? @unique` to DeliveryRecord in prisma/schema.prisma; migrate.

### Step 2 — Shared: distribution helpers
- [x] `packages/shared/src/distribution.ts`: `buildDeliveryEmail(caseInfo, url)`, `prefillFromPatient(patient)`.
- [x] export; tests.

### Step 3 — Mailer gmail-smtp impl
- [x] `apps/api/lib/mailer/index.ts`: add GmailSmtpMailer (nodemailer, SMTP_* env); factory selects by MAILER_PROVIDER. Stub remains default.

### Step 4 — Services
- [x] `lib/services/directory.service.ts`: list/create/quickAdd contacts.
- [x] `lib/services/distribution.service.ts`: distribute (guard aprobado, DeliveryRecord+token, mailer/link, audit, status ENTREGADO), serveDelivery(token) (mark accessedAt).
- [x] `lib/services/patient.service.ts` (ext): searchPatients, getPatient (con casos), prefill.
- [x] `lib/services/dashboard.service.ts`: listCases + indicadores.

### Step 5 — Routes
- [x] panel/directory (GET/POST), panel/cases/[id]/distribute (POST), panel/patients (GET search), panel/patients/[id] (GET), panel/dashboard (GET), download/delivery/[token] (GET).

### Step 6 — Frontend
- [x] DashboardPage (casos por estado), DirectoryPage, DistributionPanel (en review), PatientHistoryPage + rutas + ApiService.

### Step 7 — Tests
- [x] PBT: buildDeliveryEmail determinismo/incluye url; prefillFromPatient round-trip.
- [x] Example: distribute sin aprobar → rechazo; distribuir aprobado → DeliveryRecord+token; abrir enlace → accessedAt; buscar paciente.

### Step 8 — Docs + verify
- [x] README; smoke: aprobar caso → distribuir a contacto → DeliveryRecord + enlace → abrir enlace sirve PDF final + accessedAt; buscar paciente en historial.

## Story traceability
US-6.1→2,4,5,6 · US-6.2→3(sheets noop) · US-6.3→4,5,6 · US-6.4→4,5,6 · US-6.5→4,5.

## Verification target
Se envía el reporte a un contacto del directorio y el paciente aparece en su historial.
