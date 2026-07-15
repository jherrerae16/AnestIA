# Requirements Verification — Questions (AnestIA)

El PRD es exhaustivo y casi todo está decidido (§16). Estas preguntas resuelven **vacíos reales** para el piloto local + dos opt-ins obligatorios de las aidlc-rules (seguridad y testing). Responde con la letra en cada `[Answer]:`. "X) Other" siempre disponible.

Contexto fijo (ya confirmado, NO se pregunta): stack KI, perfil único Luquetta, envío manual del enlace, IA con stub, firma visual, HITL estricto, examen físico pendiente, event-driven pg-boss, sin contenedores, español.

---

## Question 1 — Autenticación del piloto
El PRD dice "sign in simple" para el perfil único sembrado, sin registro masivo. ¿Cómo implemento el login en el piloto?

A) Contraseña simple sembrada (email + password de Luquetta en el seed; sesión con cookie httpOnly). Suficiente y realista para el piloto.
B) Sin login real todavía — auto-sesión como Luquetta al abrir el panel (dev-only); auth se añade en Fase 7.
C) Enlace mágico / código por correo (requiere envío de correo funcionando ya).
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Almacenamiento de archivos (adjuntos, PDFs, firma, logo)
El PRD pide "object storage cifrado con URLs firmadas". En un piloto local sin contenedores/nube:

A) Filesystem local (carpeta `storage/` fuera del repo, sirviendo los archivos vía Route Handler con token de caso; hash de archivo guardado). Cloud-agnóstico, cero infra. Migrable a S3 después detrás de un adaptador `lib/storage/`.
B) S3 real (requiere credenciales AWS que debes proveer ahora).
C) Guardar binarios en PostgreSQL (bytea). Simple pero pesado.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 3 — Envío del reporte final (Módulo 8, distribución al destinatario)
El envío del enlace AL PACIENTE es manual (confirmado). Pero la distribución del PDF final a clínica/aseguradora/médico (Fase 6) es aparte. En el piloto:

A) Stub de correo detrás de adaptador `lib/mailer/` (registra el DeliveryRecord + genera enlace de descarga tokenizado; no manda correo real todavía). Un solo punto de cambio para activar SMTP luego. Coherente con la estrategia stub de la IA.
B) SMTP real ya (me pasas credenciales SMTP/servicio de correo ahora).
C) Solo enlace de descarga tokenizado con botón copiar (igual que el enlace al paciente: el anestesiólogo lo comparte manualmente). Sin correo en el piloto.
X) Other (describe después de [Answer]:)

[Answer]: Mailer real vía SMTP de Gmail (App Password) detrás del adaptador lib/mailer/, conservando DeliveryRecord y enlace de descarga tokenizado. Migrable a un servicio transaccional después.

## Question 4 — Recordatorios automáticos al paciente (RF-2.3)
El PRD pide recordatorios si el paciente no completa en X horas. En el piloto de envío manual:

A) Diferir a Fase 7 — no implementar recordatorios automáticos en el piloto (el envío es manual de todos modos). Dejar el gancho en el modelo.
B) Implementar ya con un job programado de pg-boss.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 5 — Preset pediátrico en el lanzamiento (§16 pendiente #12)
¿Incluyo un preset "Pediátrica" sembrado desde el arranque, o solo el base "Preanestésica general"?

A) Solo "Preanestésica general" (22 preguntas) en el seed; presets adicionales los crea Luquetta con el constructor (Fase 1).
B) Sembrar también "Pediátrica" desde el inicio.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 6 — Exportación opcional a Google Sheets (RF-2.5)
PostgreSQL es la fuente de verdad (confirmado). La exportación a Sheets es "opción secundaria". ¿La incluyo?

A) No incluir en el piloto — fuera de alcance hasta que se pida (evita dependencia de Google API).
B) Incluir como export manual bajo demanda.
X) Other (describe después de [Answer]:)

[Answer]: B

## Question 7 — Assets de branding de Luquetta para el seed (§16 #13)
Para sembrar el perfil necesito: nombre completo, especialidad, registro médico, logo de clínica (PNG), firma (PNG), texto de pie. El PRD dice que se entregan cuando la fase lo pida. Para arrancar Fase 0/4:

A) Sembrar con placeholders (nombre "Dr. Jorge A. Luquetta", especialidad "Anestesiología Cardiovascular", registro "PENDIENTE", logo/firma = placeholders generados). Los reemplazas con archivos reales cuando llegue Fase 4 (PDF). No bloquea nada.
B) Me esperas — te paso los assets reales antes de sembrar.
X) Other (describe después de [Answer]:)

[Answer]: A

---

## Question 8 — [OPT-IN aidlc-rules] Extensión de Seguridad
¿Se deben aplicar las reglas de la extensión de SEGURIDAD como restricciones bloqueantes en este proyecto?

A) Sí — aplicar todas las reglas de SEGURIDAD como restricciones bloqueantes (recomendado para aplicaciones de grado producción). *Nota: este sistema maneja datos sensibles de salud (Ley 1581), así que encaja.*
B) No — omitir todas las reglas de SEGURIDAD (adecuado para PoCs, prototipos y proyectos experimentales).
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 9 — [OPT-IN aidlc-rules] Extensión de Property-Based Testing
¿Se deben aplicar las reglas de property-based testing (PBT) como restricciones bloqueantes?

A) Sí — aplicar todas las reglas de PBT como bloqueantes (recomendado para proyectos con lógica de negocio, transformaciones de datos, serialización o componentes con estado).
B) Parcial — aplicar PBT solo para funciones puras y round-trips de serialización (adecuado para proyectos con complejidad algorítmica limitada). *Nota: encajaría en IMC, clasificación de flags de lab, validación Zod round-trip.*
C) No — omitir todas las reglas de PBT (adecuado para CRUD simple, proyectos solo-UI o capas de integración finas sin lógica de negocio significativa).
X) Other (describe después de [Answer]:)

[Answer]: A
