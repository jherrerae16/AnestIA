# U1 Captura — Código generado (resumen)

## Qué hace
Reemplaza el Google Form: constructor/gestión de presets, creación de casos con enlace tokenizado (copiar/enviar manual), formulario del paciente (consentimiento Ley 1581, preguntas condicionales, adjuntos, guardado parcial, submit), persistencia transaccional y emisión de `form.submitted`.

## Archivos creados (U1)
**packages/shared/src/**: preset.ts (`isVisible`, questionSchema, presetSchema), form.ts (`formAnswersSchema`, `validateAnswers`, límites de archivo), consent.ts (`CONSENT_TEXT_V1`), + tests.
**apps/api/lib/**: audit/index.ts, auth/token.ts (`verifyCaseToken`, `generateCaseToken`), auth/session-helper.ts (`requireSession`), services/{preset,case,form,patient}.service.ts, queue/index.ts (colas pipeline creadas).
**apps/api/app/api/**: panel/presets(+[id]), panel/cases(+[id]), form/[token] (get/consent/save/upload/submit), download/[key].
**apps/web/src/app/**: core/api.service.ts, pages/{case-creator,preset-list,patient-form}.page.ts, shell nav, rutas (form público por token).

## Verificación (ejecutada)
- ✅ Tests: 14 verdes (9 shared incl. **PBT motor condicional** [oculta⇒no-obligatoria], validateAnswers, answers round-trip; 5 api de U0).
- ✅ Backend smoke end-to-end:
  - login → listar presets (22 preguntas) → crear caso → enlace + expiry 7d
  - abrir form por token (sin sesión) 200
  - **submit sin consentimiento → 422** (gate Ley 1581)
  - aceptar consentimiento → 200
  - **submit con obligatorias faltantes → 422** con errores por campo (validación vs preset)
  - submit válido → `{ok:true}`; **Case=RESPUESTAS_RECIBIDAS**, FormResponse submitted, **Patient auto-creado** (upsert), **`form.submitted` encolado** en pg-boss, audit (case.created/consent.accepted/form.submitted)
  - re-submit → idempotente (sin re-emitir)
- ✅ Angular build: todas las páginas compilan (patient-form, case-creator, signin, shell, preset-list, dashboard).

## Decisiones/arreglos durante la generación
- pg-boss v10 exige `createQueue` antes de encolar → se registran las 5 colas del pipeline al iniciar.
- Duplicado de rxjs en apps/web/node_modules → `npm dedupe` (choque de tipos Observable).
- Angular 19: `provideExperimentalZonelessChangeDetection` (nombre nuevo).
- Consentimiento: texto estándar `CONSENT_TEXT_V1` (reemplazable por el texto legal del Dr. Luquetta).
- Descarga de adjuntos restringida al panel (sesión + dueño del caso) — SECURITY-08.

## Pendiente
- Constructor visual de preguntas (editor drag/add) — iteración posterior; el preset base ya está sembrado y editable vía API.
- Front live-serve (ng serve) — build verificado; interacción real en Build&Test.
