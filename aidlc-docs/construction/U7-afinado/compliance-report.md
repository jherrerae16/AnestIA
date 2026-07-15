# AnestIA — Reporte de Cumplimiento (Reviewer hat)

Repaso final del piloto. Cada regla con evidencia (dónde se cumple + verificación). Fecha: 2026-07-15.

## Reglas de seguridad clínica (CS1–CS8)

| # | Regla | Cumplida | Evidencia |
|---|---|---|---|
| **CS1** | HITL: el anestesiólogo aprueba todo; la IA nunca autoenvía | ✅ | Envío del enlace = manual (US-1.2). Aprobación sólo por handler autenticado (`approve`, U5). Distribución sólo tras aprobación (U6). Verificado: distribuir no-aprobado→422. |
| **CS2** | No fabricar datos clínicos; cada dato con `fuente` | ✅ | `extractLabs`: [] sin adjuntos (U2). `enforceGuardrails`: estado≠ok⇒valor null (U3). documentSchema exige fuente. PBT enforceGuardrails. |
| **CS3** | Examen físico/vitales = pendiente; bloquea aprobación | ✅ | Motor deja examen `pendiente_examen` (U3). `canApprove` bloquea (U5). Verificado: aprobar con examen pendiente→422. PDF marca BORRADOR (U4). PBT canApprove. |
| **CS4** | IA deriva (IMC/ASA/dx/plan) de datos reales, no inventa | ✅ | `computeIMC` por código sobrescribe al LLM (U3). ASA/dx/plan marcados `derivado:IA`. PBT computeIMC oracle. |
| **CS5** | Salida estructurada Zod; malformada rechazada | ✅ | `documentSchema.parse` en `generateForCase` (U3); `generateObject` con schema para el modelo real. |
| **CS6** | Zod en cada borde (entrada+salida) | ✅ | Todas las rutas parsean con Zod (login, form, preset, case, edit, exam, directory, distribute). |
| **CS7** | Versión aprobada inmutable + audit | ✅ | ApprovalRecord snapshot+hash+lockedPdfUrl; guard edición→409 (U5). AuditLog append-only. Verificado: editar tras aprobar→409. |
| **CS8** | GLP-1 → lógica broncoaspiración | ✅ | `detectGLP1` (U2); recomendaciones de ayuno en el assessment (U3). Verificado: "Ozempic"→glp1.detected + recs. |

## Extensiones (aidlc-rules)

### Security Baseline
| Regla | Estado | Nota |
|---|---|---|
| SECURITY-01 cifrado | Parcial/N-A | TLS en prod (pendiente hosting); disco en piloto. Documentado. |
| SECURITY-02/06/07 (LB/IAM/red) | N/A | Sin cloud en el piloto local. |
| SECURITY-03 logging | ✅ | pino con redacción de secretos. |
| SECURITY-04 headers | ✅ | CSP/HSTS/nosniff/XFO/Referrer en middleware. |
| SECURITY-05 validación | ✅ | Zod + límites de tamaño/archivos. |
| SECURITY-08 authz | ✅ | Panel por sesión+ownership; form/download por token (anti-IDOR). |
| SECURITY-09 hardening | ✅ | Sin credenciales por defecto (seed genera pass); errores genéricos; allowlist de archivos. |
| SECURITY-10 supply chain | ⚠️ | Lockfile commiteado; npm audit documentado (dependency-security.md); sin fix --force. Acción pendiente pre-producción. |
| SECURITY-11 rate limit | ✅ | Rate-limit in-memory en form/download/login (U7). |
| SECURITY-12 auth/secrets | ✅ | argon2id; cookie httpOnly/Secure(prod)/SameSite; throttle; secretos env. |
| SECURITY-13 integridad | ✅ | Snapshot+hash de la versión aprobada; no deserialización insegura. |
| SECURITY-14 alerting/audit | ✅(piloto) | AuditLog append-only, retención en BD. Alerting de eventos = futuro. |
| SECURITY-15 fail-closed | ✅ | apiHandler global; jobs no avanzan si fallan; reintentos pg-boss. |

### Property-Based Testing (FULL, fast-check)
- ✅ PBT en: password hash/sesión (U0), motor condicional + validateAnswers + answers round-trip (U1), flagLab determinismo/monotonicidad/oracle + GLP-1 (U2), computeIMC oracle/monótona + enforceGuardrails (U3), documentHtml determinismo/watermark/escape (U4), canApprove invariante (U5), deliveryEmail/prefill (U6), rateLimit (U7).
- Complementados con tests de ejemplo. **42 tests verdes** en total.
- Acción pendiente: integrar la suite en CI con log de semilla (PBT-08) — instrucciones en Build&Test.

## Regulatorio
- **Ley 1581/2012**: consentimiento versionado capturado ANTES de recolectar datos (US-1.3, `Consent`); aislamiento de pacientes por anestesiólogo; minimización.
- **Inmutabilidad post-firma** (Res. 1995/Ley 2015): ApprovalRecord + guard + PDF final inmutable.
- **HITL**: gate humano obligatorio; responsabilidad clínica del anestesiólogo; disclaimers en el documento.

## Pendientes conocidos (no bloquean el piloto)
- Integrar `ANTHROPIC_API_KEY` (motor/visión reales) — un cambio de env (`AI_PROVIDER=anthropic`).
- SMTP Gmail real (App Password) y export Sheets (OAuth) — env.
- Actualización de deps + escáner CI antes de producción.
- Assets reales de branding del Dr. Luquetta.
- Validación clínica de los umbrales de laboratorio por el Dr. Luquetta.
- Preview visual del PDF (poppler no instalado en el entorno de build).

## Veredicto
El piloto cumple las 8 reglas de seguridad clínica y las reglas aplicables de las extensiones, con evidencia verificada end-to-end. Listo para uso piloto local supervisado; los pendientes son integraciones de credenciales/producción, no defectos del núcleo.
