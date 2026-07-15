# U0 — Business Rules

- **BR-0.1** Anesthesiologist.email is unique; seed upserts on it (idempotent). [US-0.2]
- **BR-0.2** Exactly one default preset per anesthesiologist (isDefault=true) in seed.
- **BR-0.3** Default preset has exactly 22 questions, order 1–22, per form-mapping.md. P1,P2 required. P21 conditional on P20=sí. P13 conditional on P12=sí.
- **BR-0.4** Password stored only as adaptive hash; never plaintext, never logged. [SECURITY-12]
- **BR-0.5** No hardcoded credentials: seed password from env `SEED_ADMIN_PASSWORD` or generated + printed once. [SECURITY-12] (pending Q1)
- **BR-0.6** Session cookie: httpOnly + Secure + SameSite=Lax; server-side expiration; invalidated on logout. [SECURITY-12]
- **BR-0.7** All `/api/panel/**` routes require a valid session (deny-by-default). [SECURITY-08]
- **BR-0.8** Login input validated by Zod (email format, password length bounds). [SECURITY-05]
- **BR-0.9** Repeated login failures throttled (lockout/delay). [SECURITY-12]
- **BR-0.10** Global error handler returns generic messages; no stack traces to client; fail-closed. [SECURITY-15]
- **BR-0.11** Tenant isolation: every panel query filtered by anesthesiologistId (even with one profile). [Ley 1581]
