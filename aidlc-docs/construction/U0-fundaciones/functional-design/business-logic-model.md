# U0 — Business Logic Model

## Flows
### F1 — Seed (npm run seed) [US-0.2]
1. Upsert Anesthesiologist "Luquetta" by unique email (idempotent).
2. Upsert default preset "Preanestésica general" (isDefault=true) owned by Luquetta.
3. Upsert its 22 Questions (order 1–22 from form-mapping.md) with types + conditional (P20→P21) + required (P1,P2).
4. Print seed summary; if password generated, print once.
- Idempotent: re-run updates in place, no duplicates (upsert on natural keys).

### F2 — Sign in [US-0.1]
1. `login(email, password)` → find anesthesiologist by email → verify adaptive hash → on success issue session (signed cookie httpOnly/Secure/SameSite) → else generic 401.
2. Brute-force: throttle repeated failures (in-memory counter per email+IP in pilot).
3. `requireSession` guards `/api/panel/**`; missing/invalid → 401 (deny-by-default).
4. `logout` invalidates session.

### F3 — App bootstrap
- Next.js API boots, registers pg-boss (no handlers yet), applies security-headers middleware + global error handler.
- Angular shell: sign-in route (public) + guarded empty dashboard.

## Data transformations
- Password → adaptive hash (store hash only).
- Session payload {anesthesiologistId, exp} → signed cookie.
- form-mapping.md rows → Question records.
