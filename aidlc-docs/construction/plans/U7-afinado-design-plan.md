# U7 Afinado — Consolidated Design Plan (FD + NFR)

U7 = hardening + cierre de cumplimiento. Stories US-7.1/7.2/7.3. Menos código nuevo, más robustez + revisión.

## Alcance
- **US-7.1 Auditoría**: el AuditLog ya se escribe en todo el ciclo; añadir cobertura donde falte + una vista/endpoint de audit por caso. Confirmar append-only (la app no borra/edita).
- **US-7.2 Reintentos/idempotencia**: configurar retryLimit/backoff en los jobs pg-boss; confirmar idempotencia de cada handler (ya implementada — verificar).
- **US-7.3 Seguridad/cifrado**: rate-limit básico en rutas públicas (form/download), confirmar headers/secrets/validación, documentar cifrado (TLS en prod, disco en piloto), auditar dependencias.
- **Reviewer hat — repaso de cumplimiento**: verificar las 8 reglas de seguridad clínica (CS1-CS8) + extensiones (Security, PBT) end-to-end y dejar un reporte.

## Testable Properties (PBT-01)
- rate-limit: N+1 requests → bloqueado (invariante).
- (idempotencia de jobs ya cubierta en U2-U4).

## Extension compliance (U7)
- Cierre de Security Baseline (rate-limit SECURITY-11, audit integrity SECURITY-14, deps SECURITY-10).
- PBT: rate-limit; suite completa corre en CI (documentar).

---

## Question 1 — Alcance del endurecimiento de dependencias
`npm audit` reporta vulnerabilidades (transitivas, típicas en dev). ¿Qué hago?

A) Documentar el estado (npm audit), fijar/lockear versiones, NO correr `npm audit fix --force` (rompe con breaking changes). Dejar constancia de vulnerabilidades HIGH/CRITICAL con nota de aceptación de riesgo para el piloto local. (recomendado — no rompe la build verificada)
B) Correr `npm audit fix --force` y arreglar lo que rompa.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Rate limiting
Rutas públicas (form del paciente, descarga). ¿Rate-limit?

A) Rate-limit in-memory básico (por IP+ruta, ventana deslizante) en form/download/login. Suficiente para el piloto; migrable a Redis/gateway en producción. (recomendado)
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 3 — Reporte de cumplimiento
El hat Reviewer deja un reporte final. ¿Formato?

A) `aidlc-docs/construction/U7-afinado/compliance-report.md`: tabla CS1-CS8 (cómo/dónde se cumple + evidencia), extensiones Security/PBT (reglas aplicables/N-A), Ley 1581, inmutabilidad, HITL. (recomendado)
X) Other (describe después de [Answer]:)

[Answer]: A

---

## Artifacts to generate (this gate)
- [x] functional-design/business-logic-model.md
- [x] functional-design/business-rules.md
- [x] nfr-requirements/nfr-requirements.md
- [x] nfr-design/nfr-design-patterns.md
- [x] nfr-design/logical-components.md
