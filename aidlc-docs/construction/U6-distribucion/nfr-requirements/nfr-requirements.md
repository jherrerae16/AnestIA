# U6 — NFR Requirements

| Category | Requirement |
|---|---|
| Integrity | Sólo distribuir el PDF aprobado inmutable (CS7). |
| Security | Enlace de descarga tokenizado; SMTP App Password como secreto env; sesión+ownership en panel. |
| Traceability | DeliveryRecord (envío+acceso); audit. |
| Privacy | Aislamiento de pacientes por anesthesiologist (Ley 1581). |
| Usability | Selección de directorio (no correos a mano); dashboard con indicadores; historial con precarga. |

## Extension NFRs
- Security 05/08/12/15.
- PBT: buildDeliveryEmail, prefillFromPatient, guard de aprobado.
