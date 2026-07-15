# U4 — Business Rules

- **BR-4.1** El PDF reproduce el Diseño Oficial (`docs/diseno-oficial.md`): encabezado con logo, identificación, antecedentes (incl. grupo sanguíneo/transfusiones/prótesis dental), paraclínicos con alertas, examen físico, valoración/plan, firma, pie. Una página cuando sea posible. [US-4.1, RF-6.1-6.6]
- **BR-4.2** Branding tomado del perfil (logo, firma, nombre, especialidad, registro). [RF-6.5]
- **BR-4.3** Mientras el examen físico esté pendiente o falten obligatorias → documento = BORRADOR (marca de agua), NO final. No se renderiza como final. [US-4.1, CS3]
- **BR-4.4** Nota estándar al pie del examen físico: "Examen físico y signos vitales verificados por el anestesiólogo tratante." [RF-6.3]
- **BR-4.5** Sólo se muestran paraclínicos realmente extraídos; alertas rojas destacadas. [RF-6.x, CS2]
- **BR-4.6** Todo valor de datos se escapa en el HTML (anti-inyección). [SECURITY-05]
- **BR-4.7** El PDF de borrador NO es inmutable (se regenera); el inmutable se produce al aprobar (U5). [CS7]
- **BR-4.8** Handler idempotente, fail-closed. [SECURITY-15]
