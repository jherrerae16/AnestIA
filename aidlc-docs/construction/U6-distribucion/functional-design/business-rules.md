# U6 — Business Rules

- **BR-6.1** Sólo se distribuye el caso APROBADO (PDF inmutable). Nunca un borrador. [US-6.1, CS7, RF-8.4]
- **BR-6.2** Los destinatarios se seleccionan del directorio (no se escriben correos a mano); alta rápida permitida. [US-6.1, RF-8.1/12.3]
- **BR-6.3** Cada envío registra DeliveryRecord (contacto, canal, sentAt); al abrir el enlace, accessedAt. [US-6.5, RF-8.3]
- **BR-6.4** El enlace de descarga es tokenizado (sin sesión); sirve sólo el PDF final del caso aprobado. [US-6.5, SECURITY-08]
- **BR-6.5** El envío SMTP real usa Gmail App Password (secreto env); sin credencial → enlace de descarga (adaptador). [SECURITY-12]
- **BR-6.6** El paciente se crea/actualiza al procesar el caso (ya en U1); el historial es su conjunto de Case. Aislamiento por anesthesiologist. [US-6.3, RF-11.7]
- **BR-6.7** Precarga de datos base al crear caso para paciente existente, marcada para reconfirmación. [US-6.3, RF-11.5]
- **BR-6.8** Export a Sheets = opcional, downstream, nunca fuente de verdad ni disparador. [US-6.2, RF-2.5]
- **BR-6.9** Todas las rutas de panel: sesión + ownership. [SECURITY-08]
