# U5 — Business Rules

- **BR-5.1** No se puede aprobar si el examen físico sigue pendiente o hay obligatorias vacías (CS3/CS1). `canApprove` es bloqueante y se re-chequea en el servidor al aprobar. [US-5.4]
- **BR-5.2** "Cargar examen normal" es una CONFIRMACIÓN ACTIVA del anestesiólogo; los valores quedan con fuente='anestesiologo' (no inventados por IA). [US-5.3, §17]
- **BR-5.3** Al aprobar: versión bloqueada (snapshot en ApprovalRecord) + firma + timestamp + aprobador + PDF final inmutable (sin marca de agua) + audit (CS7). [US-5.4, RF-7.6]
- **BR-5.4** Tras aprobar, el GeneratedAssessment no se edita (guard). El PDF final es inmutable; sólo se reenvía desde esa versión. [CS7]
- **BR-5.5** Rechazar reabre el formulario al paciente; no hay aprobación parcial. [US-5.5]
- **BR-5.6** Todas las rutas de revisión/aprobación requieren sesión + ownership del caso (el anestesiólogo dueño). [SECURITY-08]
- **BR-5.7** Ediciones validadas (Zod) antes de aplicar. [SECURITY-05]
- **BR-5.8** La IA nunca aprueba ni envía; sólo el anestesiólogo (CS1). [US-5.4]
