# Personas — AnestIA

Pilot personas (3 active). Admin/auxiliar listed as future, no stories.

---

## P1 — Anestesiólogo (Dr. Jorge A. Luquetta) — PRIMARY
- **Archetype**: Anestesiólogo cardiovascular, alto volumen, tiempo escaso. Único responsable clínico y legal del documento firmado.
- **Access mode**: Cuenta sembrada, sign in con contraseña, workspace propio.
- **Goals**: Reducir a <5 min su trabajo por caso (solo revisar/aprobar); no dejar pasar alertas; documento pulido y branded; trazabilidad.
- **Context**: Trabaja entre cirugías; revisa desde escritorio; el examen físico presencial ocurre en otro momento que el formulario.
- **Pains (hoy)**: Flujo fragmentado (Forms+Drive+IA+editor+correo); transcripción manual; sin estado del caso; riesgo de omitir alertas; datos sensibles por canales inseguros.
- **Non-negotiables**: Nada se envía sin su aprobación; nunca datos clínicos inventados; puede editar todo antes de firmar.

## P2 — Paciente — SECONDARY (sin cuenta)
- **Archetype**: Paciente pre-quirúrgico, cualquier edad/alfabetización digital, responde desde el móvil.
- **Access mode**: Enlace tokenizado de un solo caso (recibido por WhatsApp del anestesiólogo). Sin login.
- **Goals**: Responder rápido y claro; adjuntar sus exámenes sin fricción; retomar si se interrumpe.
- **Context**: Móvil, posible conexión intermitente, en casa.
- **Pains (hoy)**: Formularios genéricos confusos; adjuntar archivos incómodo; no sabe si su envío llegó.
- **Non-negotiables**: Consentimiento Ley 1581 explícito antes de dar datos; sus datos no visibles para otros médicos.

## P3 — Destinatario (clínica / aseguradora / médico) — SECONDARY (sin cuenta)
- **Archetype**: Contacto institucional que recibe el reporte final aprobado.
- **Access mode**: Recibe el PDF por correo (SMTP) y/o enlace de descarga tokenizado. Sin login.
- **Goals**: Obtener el documento final válido, legible, del paciente correcto.
- **Context**: Correo institucional; puede reenviar internamente.
- **Pains (hoy)**: Recibe PDFs inconsistentes por canales informales; sin trazabilidad de entrega.
- **Non-negotiables**: Solo recibe la versión aprobada e inmutable.

---

## Future personas (no stories in pilot)
- **Administrador de clínica** — gestión de tenant, usuarios, branding institucional. (Fase posterior.)
- **Auxiliar / asistente** — crea/envía casos y da seguimiento; NO puede aprobar. (Fase posterior.)
