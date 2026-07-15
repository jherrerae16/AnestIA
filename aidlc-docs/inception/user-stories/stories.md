# User Stories — AnestIA

Format: `As a <persona>, I want <capability>, so that <benefit>.` + Given/When/Then acceptance criteria. 🔒 = clinical-safety criterion (blocking). Tags: `[RF-x]` PRD requirement, `[Fase N]` build phase. Personas: P1 Anestesiólogo, P2 Paciente, P3 Destinatario.

Legend of clinical-safety rules referenced: CS1 HITL · CS2 no-fabrication+fuente · CS3 exam pending blocks approval · CS4 derive-only · CS5 structured Zod output · CS6 Zod both borders · CS7 immutability+audit · CS8 GLP-1 logic.

---

## EPIC 0 — Fundaciones (P1) [Fase 0]

### US-0.1 — Sign in del perfil sembrado
As a anesthesiologist, I want to sign in to my seeded workspace with a password, so that only I access my cases and branding. [RF-10.1][Fase 0]
- **Given** the seed created Luquetta (email + hashed password), **When** I submit valid credentials, **Then** a secure session cookie (httpOnly, Secure, SameSite) is set and I land on my dashboard.
- **Given** invalid credentials, **When** I submit, **Then** access is denied with a generic message (no detail leak) 🔒 and repeated failures are throttled.
- 🔒 Password stored via adaptive hashing; never logged. Every panel route requires a valid session (deny-by-default).

### US-0.2 — Workspace multi-tenant-ready sembrado
As a system, I want the data model seeded multi-anesthesiologist even with one profile, so that scaling later doesn't require reshaping data. [RF-10.1][Fase 0]
- **Given** `npm run seed`, **When** it runs, **Then** it creates the Luquetta profile + default preset ("Preanestésica general", 22 questions) and is idempotent (re-run doesn't duplicate).
- **Given** any query for cases/patients, **Then** results are scoped by `anesthesiologistId` (isolation). 🔒

---

## EPIC 1 — Captura y cuestionarios (P1, P2) [Fase 1]

### US-1.1 — Constructor de presets
As an anesthesiologist, I want to create/name/version questionnaire presets with typed questions, required flags, and conditional logic, so that I tailor forms per procedure. [RF-1.1–1.9][Fase 1]
- **Given** the builder, **When** I add questions (texto/selección/fecha/número/sí-no/archivo), mark required, set conditional (e.g. P20=sí → show P21), **Then** the preset saves with `version` incremented and prior sent cases keep their original version. 🔒 CS7-adjacent
- **Given** the default preset, **When** I edit it, **Then** a new version is created (existing links unaffected).

### US-1.2 — Crear caso + enlace tokenizado (envío manual)
As an anesthesiologist, I want to create a case and get a tokenized link with a copy button, so that I send it to the patient via my own WhatsApp. [RF-2.1, RF-2.2][Fase 1]
- **Given** a new case, **When** I pick a preset, **Then** a unique `linkToken` (unguessable, expirable) is generated with a copy-to-clipboard button.
- 🔒 The platform does NOT auto-send; sending is manual (CS1). Case status → `ENVIADO_AL_PACIENTE`.

### US-1.3 — Consentimiento Ley 1581 al inicio del formulario
As a patient, I want to see and accept the data-treatment consent before answering, so that my sensitive data is handled lawfully. [RF-1.8][Fase 1]
- **Given** the tokenized form, **When** it opens, **Then** the Ley-1581 consent text (versioned) is shown first and I must accept to proceed.
- **When** I accept, **Then** a `Consent` record (textVersion + timestamp) is persisted. 🔒 No data collected before consent.

### US-1.4 — Responder formulario branded, mobile-first
As a patient, I want a clear, branded, mobile-first form, so that I answer easily from my phone. [RF-2.4][Fase 1]
- **Given** the link on mobile, **Then** the form shows the anesthesiologist's logo, is responsive, honors conditional logic, and validates required fields client + server (Zod both borders 🔒 CS6).
- **Given** accessibility, **Then** contrast/labels meet the web-design-guidelines audit.

### US-1.5 — Cargar adjuntos (labs/ECG/eco/imágenes)
As a patient, I want to attach my exams, so that they're analyzed automatically. [RF-2.4, RF-3.2, RF-3.3][Fase 1]
- **Given** the form, **When** I upload PDF/JPG/PNG, **Then** each file is stored (local FS adapter, tokenized access), typed (hemograma/coagulación/ECG/eco/otro), and its hash saved.
- 🔒 Files served only via tokenized route bound to the case (object-level authz, no IDOR).

### US-1.6 — Guardado parcial (no dispara pipeline)
As a patient, I want to save partial answers and resume later from the same link, so that I don't lose progress. [RF-2.6][Fase 1]
- **Given** partial answers, **When** I save, **Then** `FormResponse.partial=true`, no event emitted, status `RESPONDIENDO`.
- **When** I finally submit, **Then** `partial=false`, `submittedAt` set, event `form.submitted` emitted (CS pipeline trigger). 🔒 only submit triggers pipeline.

### US-1.7 — Persistencia como fuente de verdad
As a system, I want answers + attachments persisted in PostgreSQL transactionally on submit, so that PostgreSQL is the single source of truth. [RF-2.5, RF-3.1][Fase 1]
- **Given** submit, **When** persisted, **Then** FormResponse + Attachments commit in one transaction, then `form.submitted` is enqueued (pg-boss).

---

## EPIC 2 — Lab Intelligence (system, P1) [Fase 2]

### US-2.1 — Extracción de valores de laboratorio (visión, tras adaptador)
As a system, I want to extract lab values from uploaded PDFs/images via the AI adapter, so that the anesthesiologist doesn't transcribe them. [RF-4.1, RF-4.2][Fase 2]
- **Given** `lab.extract` job, **When** it runs with adapter=stub, **Then** it returns example values; with adapter=anthropic + key, it calls Claude vision.
- 🔒 CS2: ONLY values actually present are recorded; a missing analyte is NEVER fabricated.
- **Given** each extracted value, **Then** an `ExtractedLabResult` is saved with `sourceRef` (traceable to the source portion). [RF-4.5]

### US-2.2 — Marcado de alertas rojas (determinístico)
As a system, I want to flag extracted values against reference ranges, so that red flags surface before human review. [RF-4.3, RF-4.4][Fase 2]
- **Given** `lab.flag` job, **When** it compares values to `lab-rules.md` ranges (by sex), **Then** each result gets `NORMAL | ALERTA | CRITICO` deterministically (no LLM).
- **Example** Given Hb 11.5 g/dL (♀), Then flag=ALERTA (anemia). Given plaquetas 90k, Then flag=CRITICO.
- 🔒 Ranges are configurable and marked "to be validated by Dr. Luquetta"; flagging never invents a value.

### US-2.3 — Detección de GLP-1 declarado
As a system, I want to detect declared GLP-1 agonists from the form, so that aspiration-risk logic is triggered. [RF-4.6][Fase 2]
- **Given** P14 mentions semaglutida/liraglutida/tirzepatida (etc.), **When** parsed, **Then** a GLP-1 marker + last-dose (if given) is recorded for the clinical engine. 🔒 CS8.

---

## EPIC 3 — Motor clínico (system) [Fase 3]

### US-3.1 — Generar borrador estructurado
As a system, I want the clinical engine to produce a Zod-validated structured draft from answers + labs, so that the document is consistent and safe. [RF-5.1–5.10][Fase 3]
- **Given** `clinical.generate`, **When** it runs `generateObject` with `prompt-maestro-v2` as system prompt, **Then** output validates against the Zod field schema or is rejected. 🔒 CS5.
- 🔒 CS2: every field carries `valor/estado/fuente`; no field populated without `fuente`.
- 🔒 CS3: examen físico + signos vitales returned as `pendiente_examen` (never default-normal).
- 🔒 CS4: IMC (code, not LLM), diagnóstico, ASA (justified), draft concepto/plan/recomendaciones are DERIVED from real data only.
- **Given** a malformed or prohibited-field-populating output, **Then** it is rejected (not persisted).
- **Given** success, **Then** `GeneratedAssessment` saved with `promptVersion` + `modelUsed`. [RF-11.5-adjacent traceability]

### US-3.2 — Lógica GLP-1 en recomendaciones
As a system, I want GLP-1 detection to drive fasting/aspiration recommendations, so that gastric-content risk is flagged. [RF-4.6, RF-5.9][Fase 3]
- **Given** a GLP-1 marker, **When** generating, **Then** recommendations include ayuno/dieta líquida/confirm GI symptoms + consider gastric ultrasound / treat as full stomach / defer. 🔒 CS8.

### US-3.3 — Cálculo determinístico de IMC
As a system, I want IMC computed in code from weight/height, so that it never depends on the LLM. [RF-5.8][Fase 3]
- **Given** peso=108kg, talla=188cm, **Then** IMC=30.6 (cm→m conversion), independent of the model. (PBT: invariant/oracle target.)

---

## EPIC 4 — Documento PDF (system, P1) [Fase 4]

### US-4.1 — Render fiel al Diseño Oficial
As an anesthesiologist, I want the draft rendered as a one-page PDF matching the Diseño Oficial with my branding, so that it's institution-grade. [RF-6.1–6.6][Fase 4]
- **Given** a generated assessment, **When** Playwright renders, **Then** the PDF matches `diseno-oficial.md` (header logo, secciones con banda, firma block) using the profile's logo/firma.
- **Given** new fields, **Then** grupo sanguíneo, transfusiones, prótesis dental appear (P22 reflected in vía aérea).
- 🔒 CS3: while examen físico is `pendiente_examen`, the document renders only as DRAFT, not final; cannot render final with required fields empty.

---

## EPIC 5 — Revisión y aprobación HITL (P1) [Fase 5]

### US-5.1 — Vista de revisión lado a lado
As an anesthesiologist, I want the draft next to source answers and labs (with sourceRef), so that I can verify every datum. [RF-7.1, RF-7.3][Fase 5]
- **Given** a case pending review, **Then** I see draft | respuestas | labs; AI-derived fields, lab alerts, inconsistencies, and `pendiente_examen` are highlighted.

### US-5.2 — Edición en línea
As an anesthesiologist, I want to edit any field before approving, so that the final reflects my judgment. [RF-7.4][Fase 5]
- **Given** any field, **When** I edit, **Then** the change is captured (for `ApprovalRecord.edits`) and validated (Zod 🔒 CS6).

### US-5.3 — Cargar/confirmar examen físico
As an anesthesiologist, I want to enter real exam values or confirm "examen normal" actively, so that no physiological value is fabricated. [RF-7.x, §17][Fase 5]
- **Given** `pendiente_examen`, **When** I click "cargar examen normal" (active confirmation) or type real values, **Then** the exam state clears to entered/confirmed.
- 🔒 CS3: the document CANNOT be approved while exam remains pending.

### US-5.4 — Aprobación bloqueante
As an anesthesiologist, I want approval blocked if required fields are empty or exam is pending, so that no incomplete document is finalized. [RF-7.2, RF-7.6][Fase 5]
- **Given** empty required fields OR pending exam, **When** I try to approve, **Then** approval is blocked with the reason listed. 🔒 CS3, CS1.
- **Given** all satisfied, **When** I approve & sign, **Then** the version is LOCKED, visual signature applied, timestamp + approver recorded, immutable PDF produced, `ApprovalRecord` + audit log written. 🔒 CS7. Status → `APROBADO`.

### US-5.5 — Rechazar / solicitar más info
As an anesthesiologist, I want to reject and reopen the form to the patient, so that missing info can be corrected. [RF-7.5][Fase 5]
- **Given** review, **When** I reject, **Then** the patient link reopens and status reflects re-solicitation; no partial approval occurs.

---

## EPIC 6 — Distribución e historial (P1, P3) [Fase 6]

### US-6.1 — Distribuir desde el directorio
As an anesthesiologist, I want to pick recipients from my directory (not type emails), so that distribution is fast and correct. [RF-8.1, RF-12.1–12.6][Fase 6]
- **Given** an approved case, **When** I select contacts (médico/clínica/aseguradora) — with quick-add — **Then** the immutable PDF is sent via SMTP (Gmail App Password, mailer adapter) and/or a tokenized download link.
- **Given** P8 aseguradora, **Then** it is suggested as a recipient. [RF-12.5]
- 🔒 CS7: only the approved, immutable version can be sent/resent (RF-8.4). A `DeliveryRecord` (channel, sentAt, accessedAt) + audit log entry is written. Status → `ENTREGADO`.

### US-6.2 — Export opcional a Google Sheets (bajo demanda)
As an anesthesiologist, I want an optional manual export to Google Sheets, so that I can share tabular data if needed. [RF-2.5][Fase 6]
- **Given** a case/report, **When** I trigger export, **Then** data is pushed to Sheets via adapter; PostgreSQL remains the source of truth (export is downstream, never the trigger).

### US-6.3 — Historial de pacientes + precarga
As an anesthesiologist, I want a searchable patient history with prefill on new cases, so that I don't recapture known data. [RF-11.1–11.7][Fase 6]
- **Given** a submitted case, **Then** the Patient is created/updated from the form (no manual recapture).
- **Given** search by documento/nombre, **Then** I find the patient and see their valoraciones (fecha, procedimiento, ASA, estado, PDF).
- **Given** a new case for an existing patient, **Then** base data prefills, marked for patient reconfirmation. 🔒 isolation per profile (CS Ley 1581).

### US-6.4 — Dashboard de casos por estado
As an anesthesiologist, I want a dashboard of cases by status with filters and alerts, so that I know what needs action. [RF-9.1–9.4][Fase 6]
- **Given** the dashboard, **Then** cases show across the state machine (BORRADOR…ENTREGADO), filterable by estado/fecha/paciente/procedimiento, highlighting pending-review, red-flag, and near-surgery-date cases.

### US-6.5 — Recepción del documento final
As a recipient, I want to receive the final approved PDF via email/link, so that I get a valid document. [RF-8.2, RF-8.3][Fase 6]
- **Given** distribution, **When** I open the email/link, **Then** I access the immutable PDF; access is logged (`accessedAt`). 🔒 CS7.

---

## EPIC 7 — Afinado y cumplimiento (system, P1) [Fase 7]

### US-7.1 — Auditoría completa e inmutable
As a system, I want an append-only audit log of all actions, so that the record is tamper-evident. [RF-8.3, §8][Fase 7]
- **Given** create/edit/approve/deliver/access, **Then** each writes an `AuditLog` entry (actor, action, entity, timestamp); the app cannot modify/delete its own audit entries. 🔒 CS7.

### US-7.2 — Reintentos e idempotencia en jobs
As a system, I want pipeline jobs retryable and idempotent, so that failures don't duplicate or corrupt a case. [§9.1][Fase 7]
- **Given** a failing `lab.extract`/`clinical.generate`, **When** retried, **Then** it re-runs without duplicating results. 🔒 fail-closed (SECURITY-15).

### US-7.3 — Seguridad y cifrado
As a system, I want security headers, encryption, input validation, and secrets management enforced, so that sensitive health data is protected. [§8][Fase 7]
- **Given** HTML endpoints, **Then** CSP/HSTS/X-Content-Type-Options/X-Frame-Options/Referrer-Policy set (SECURITY-04).
- **Given** any API, **Then** Zod input validation + size bounds + parameterized queries (SECURITY-05). 🔒
- **Given** secrets (ANTHROPIC_API_KEY, SMTP App Password, Sheets OAuth), **Then** env-only, never committed/logged (SECURITY-12).

---

## Coverage check
- **PRD modules 1–12**: covered (M1 US-1.1; M2 US-1.2/1.3/1.4/1.6; M3 US-1.5/1.7; M4 US-2.x; M5 US-3.x; M6 US-4.1; M7 US-5.x; M8 US-6.1/6.5; M9 US-6.4; M10 US-0.1/0.2; M11 US-6.3; M12 US-6.1).
- **Clinical-safety rules CS1–CS8**: CS1 US-1.2/5.4; CS2 US-2.1/3.1; CS3 US-3.1/4.1/5.3/5.4; CS4 US-3.1/3.3; CS5 US-3.1; CS6 US-1.4/5.2/7.3; CS7 US-5.4/6.1/6.5/7.1; CS8 US-2.3/3.2.
- **Extensions**: Security → US-0.1/1.5/7.3; PBT targets → US-3.3 (IMC), US-2.2 (flags), US-3.1 (Zod round-trip), US-0.2/state machine.
