# U6 Distribución e Historial — Consolidated Design Plan (FD + NFR)

U6 = cierra el ciclo. Distribución del PDF final por directorio + historial de pacientes + dashboard. Stories US-6.1…6.5.

## Alcance
- **Directorio de contactos** (CRUD): médicos/clínicas/aseguradoras/pacientes; alta rápida.
- **Distribución** (US-6.1/6.5): sólo del caso APROBADO (PDF inmutable). Selección de contactos del directorio → envío por SMTP (Gmail) y/o enlace de descarga tokenizado. DeliveryRecord (canal, sentAt, accessedAt). Aseguradora P8 sugerida.
- **Historial de pacientes** (US-6.3): búsqueda por documento/nombre; ficha con valoraciones; precarga al crear caso para paciente existente.
- **Dashboard** (US-6.4): casos por estado + filtros + indicadores (pendiente revisión, alertas rojas, próximos a cirugía).
- **Export Sheets** (US-6.2): opcional bajo demanda (adaptador; noop por defecto).

## Testable Properties (PBT-01)
- **buildDeliveryEmail** — determinístico; incluye enlace de descarga.
- **prefillFromPatient** — round-trip: precarga = datos base del paciente.
- Distribución sólo si aprobado (invariante).

## Extension compliance (U6)
- Security: 08 (rutas panel sesión+ownership; descarga final tokenizada), 05 (validación), 12 (SMTP App Password = secreto env), 15.
- PBT: email builder, prefill, guard de aprobado.

---

## Question 1 — SMTP Gmail ahora o después
El envío real por SMTP (Gmail App Password) requiere tu credencial. ¿La integro ahora o construyo con enlace + stub y activo SMTP luego?

A) Construir con **enlace de descarga tokenizado** (funciona sin credencial) + adaptador mailer listo; el envío SMTP real se activa cuando me pases `SMTP_USER`/`SMTP_PASS` (App Password) — un cambio de env. DeliveryRecord se registra en ambos casos. (recomendado — no bloquea; coherente con la estrategia de adaptadores)
B) Me pasas ahora el Gmail + App Password y lo integro real ya.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Descarga del PDF final por el destinatario
El destinatario recibe un enlace. ¿Cómo lo protejo?

A) Enlace de descarga tokenizado por DeliveryRecord (token único, sin sesión); registra accessedAt al abrir. Sólo sirve el PDF final inmutable del caso aprobado. (recomendado)
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 3 — Export a Google Sheets
US-6.2 opcional. ¿Lo dejo como stub (noop) por ahora?

A) Adaptador `sheets` con noop (ya existe); botón de export deshabilitado/"próximamente"; se activa con credenciales de Google (diferido). No bloquea el cierre del ciclo. (recomendado)
B) Integrarlo real ahora (requiere OAuth/service account de Google que debes proveer).
X) Other (describe después de [Answer]:)

[Answer]: A

---

## Artifacts to generate (this gate)
- [x] functional-design/business-logic-model.md
- [x] functional-design/business-rules.md
- [x] functional-design/domain-entities.md
- [x] functional-design/frontend-components.md
- [x] nfr-requirements/nfr-requirements.md
- [x] nfr-requirements/tech-stack-decisions.md
- [x] nfr-design/nfr-design-patterns.md
- [x] nfr-design/logical-components.md
