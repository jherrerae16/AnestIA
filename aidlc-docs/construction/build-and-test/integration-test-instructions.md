# Integration Test Instructions — AnestIA

Prueba las interacciones entre unidades: el **pipeline event-driven completo** + el gate humano + la distribución.

## Setup
```bash
# BD migrada + sembrada (ver build-instructions)
npm run seed
# Terminal 1: API
npm run dev:api          # :3000
# Terminal 2: Worker (pipeline)
npm run worker
```

## Escenario 1 — Pipeline completo (U1→U2→U3→U4)
`form.submitted → lab.extract → lab.flag → clinical.generate → document.render`
1. Login (POST /api/panel/auth/login) → cookie.
2. Crear caso (POST /api/panel/cases) → linkToken.
3. Abrir form (GET /api/form/:token), aceptar consentimiento (POST .../consent), subir adjunto (POST .../upload), enviar (POST .../submit con respuestas incl. P14="Ozempic").
4. **Esperado** (worker procesa): ExtractedLabResult (7 analitos + sourceRef), flags determinísticos, GLP-1 detectado, GeneratedAssessment (IMC por código, examen pendiente, ASA), PDF de borrador, Case.status=PENDIENTE_REVISION.

Verificación (ejecutada): audit trail de 8 eventos; IMC=27.3; signos_vitales=pendiente_examen; glp1=ozempic; PDF 101KB.

## Escenario 2 — Gate humano (U5)
1. GET /api/panel/cases/:id/review → canApprove.ok=false (examen pendiente).
2. **POST .../approve → 422** (bloqueado).
3. POST .../exam {mode:normal} → 200.
4. POST .../approve → 200; Case=APROBADO, ApprovalRecord + lockedPdfUrl.
5. **PATCH .../assessment → 409** (inmutable).

## Escenario 3 — Distribución (U6)
1. Crear contacto (POST /api/panel/directory).
2. POST /api/panel/cases/:id/distribute {contactIds, channel:link} → DeliveryRecord + url; Case=ENTREGADO.
3. GET /api/download/delivery/:token → 200 application/pdf; accessedAt registrado.
4. **Distribuir caso no aprobado → 422**.

## Escenario 4 — Seguridad (U7)
- GET /api/panel/cases/:id/audit → timeline (12 eventos).
- >30 requests a /api/form/:token en 10s → **429**.

## Cleanup
```bash
# reset BD de desarrollo (destruye datos):
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="..." npx prisma migrate reset --force
```
