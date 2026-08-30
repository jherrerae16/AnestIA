# PRD — AnestIA
### Plataforma de Valoración Preanestésica Automatizada

| | |
|---|---|
| **Versión** | 1.7 (Draft) |
| **Fecha** | 14 de julio de 2026 |
| **Cambios v1.7** | LLM = Claude con key provista después; desarrollo con stub tras adaptador (una sola pieza cambia al integrar la key) |
| **Cambios v1.6** | Nombre confirmado: **AnestIA** · Perfil piloto único: "Luquetta" |
| **Cambios v1.5** | Modo piloto: hosting diferido · auth de cuenta única · envío del enlace al paciente manual (sin WhatsApp API) |
| **Cambios v1.4** | Firma visual (imagen) como mecanismo estándar; firma certificada baja a opcional según receptor |
| **Cambios v1.3** | Stack confirmado = el de Knowledge Intelligence (Angular 19+ · Next.js API Routes · PostgreSQL+pgvector · Prisma · Zod · Vercel AI SDK · Playwright · pg-boss) |
| **Cambios v1.2** | Se elimina el enfoque MVP (producto completo) · Orquestación event-driven del flujo · Anexo C: Diseño Oficial (plantilla de salida) · Anexo D: Prompt Maestro Ampliado v2 (anti-alucinaciones) |
| **Cambios v1.1** | Formulario completo (22 preguntas) · Modelo multi-anestesiólogo · Presets de formulario y branding por perfil · Base de datos e historial de pacientes · Directorio de destinatarios |
| **Autor** | José Carlos Herrera Reyes |
| **Metodología** | AI-DLC Hat-Based (Claude Code) |
| **Cliente ancla / referencia clínica** | Dr. Jorge A. Luquetta — Anestesiólogo Cardiovascular (Clínica Portoazul, Barranquilla) |
| **Nombre** | **AnestIA** (confirmado) |
| **Estado** | Pendiente de decisiones de arquitectura (ver §16) |

---

## 1. Resumen ejecutivo

AnestIA es una plataforma web que automatiza de extremo a extremo el ciclo de la **valoración preanestésica**: desde el envío del cuestionario al paciente, hasta la generación, revisión, aprobación y distribución del documento clínico firmado por el anestesiólogo.

Hoy el proceso funciona, pero de forma **fragmentada y manual**: el anestesiólogo envía un Google Form, recibe respuestas dispersas, adjunta manualmente los exámenes de sangre, copia y pega la información en un asistente de IA con un prompt maestro, obtiene un borrador, lo verifica a ojo y lo convierte a PDF por su cuenta. AnestIA colapsa todo ese flujo en una sola plataforma trazable, segura y conforme a la normativa colombiana de datos sensibles en salud.

El diferenciador central es un **motor clínico de IA con guardarraíles estrictos** (nunca inventa antecedentes, medicamentos, alergias ni laboratorios) que interpreta el lenguaje coloquial del paciente, analiza los paraclínicos cargados, detecta alertas rojas, calcula IMC/ASA e infiere el plan y concepto anestésico — todo bajo un **gate obligatorio de aprobación humana** (HITL) por parte del anestesiólogo, que es el responsable clínico y legal del documento.

---

## 2. Problema y contexto

### 2.1 Flujo actual (manual)

1. El anestesiólogo comparte un **Google Form** con el paciente con preguntas predeterminadas de valoración preanestésica.
2. El paciente responde y adjunta sus exámenes (laboratorios, ECG, ecocardiograma).
3. El anestesiólogo toma las respuestas, las pega en un asistente de IA junto con el **Prompt Maestro**, y le pide generar la plantilla + recomendaciones.
4. Revisa manualmente el borrador y lo convierte a PDF por separado.
5. Envía el PDF a quien corresponda (paciente, clínica, aseguradora).

### 2.2 Dolores identificados

| Dolor | Impacto |
|---|---|
| Proceso fragmentado en ≥4 herramientas (Forms + Drive + IA + editor + correo) | Fricción, pérdida de tiempo, errores de transcripción |
| Carga y análisis manual de laboratorios | Riesgo de omitir alertas clínicas; lento |
| Sin trazabilidad ni estado del caso | No se sabe quién respondió, qué falta, qué está aprobado |
| Sin control formal de campos vacíos / obligatorios | Documentos incompletos llegan a revisión |
| Datos sensibles de salud circulando por Google Forms y chats | Riesgo de cumplimiento (Ley 1581 / dato sensible) |
| Diseño y firma aplicados manualmente | Inconsistencia entre documentos |
| No escalable a más anestesiólogos / clínicas | Depende de la operación artesanal de una persona |

---

## 3. Objetivos y métricas de éxito

### 3.1 Objetivos de producto

- **O1.** Reducir el tiempo por valoración de ~15–25 min manuales a **< 5 min de trabajo del anestesiólogo** (solo revisión y aprobación).
- **O2.** Centralizar el 100% del ciclo en una sola plataforma (0 herramientas externas).
- **O3.** Análisis automático de paraclínicos con **detección de alertas rojas** antes de la revisión médica.
- **O4.** Garantizar 0 documentos con campos obligatorios vacíos que lleguen a distribución.
- **O5.** Cumplir con la normativa colombiana de datos sensibles en salud y trazabilidad clínica.

### 3.2 Métricas (KPIs)

| KPI | Meta |
|---|---|
| Tiempo de trabajo del anestesiólogo por caso | < 5 min |
| Tiempo total paciente→documento aprobado | < 24 h |
| % de campos autocompletados por IA (sin edición) | > 80% |
| Tasa de captura de alertas de laboratorio relevantes | 100% de valores fuera de rango extraíbles |
| Campos obligatorios vacíos en documento distribuido | 0% |
| Casos completados sin salir de la plataforma | 100% |

---

## 4. Alcance

> **Enfoque:** no se construye un MVP mínimo. El objetivo es **la mejor plataforma posible** de valoración preanestésica: completa, pulida y lista para uso profesional real. Las "extensiones posteriores" no son recortes del producto, sino integraciones de terceros que dependen de acuerdos externos.

### 4.1 Alcance del producto (v1 completa)

- Constructor de presets de cuestionario por anestesiólogo.
- Formulario del paciente **nativo, atractivo y branded**, con envío del enlace por WhatsApp.
- Carga y análisis de paraclínicos con extracción y alertas rojas.
- Motor clínico de IA (Prompt Maestro Ampliado) → campos estructurados del documento, con regla estricta de no inferir sin sustento.
- Renderizado del PDF fiel al **Diseño Oficial** (logo, firma, una página) — ver Anexo C.
- Bandeja de revisión y **aprobación HITL** con validación de campos y examen físico "pendiente".
- **Firma visual** del anestesiólogo (imagen PNG/PDF del perfil) insertada en el PDF aprobado; firma certificada opcional según el receptor (ver §13).
- Distribución vía **directorio de contactos** con trazabilidad de entrega y acceso.
- **Base de datos e historial de pacientes** por perfil (consulta, ficha, evolución).
- Dashboard de gestión de casos por estado.
- Multi-anestesiólogo completo (workspace, branding, presets, directorio e historial propios).
- Auditoría, seguridad y cumplimiento (Ley 1581 / historia clínica) desde el núcleo.

### 4.2 Extensiones posteriores (dependen de terceros)

- Integración con historia clínica electrónica de terceros (HL7/FHIR) — requiere acuerdos con cada institución.
- Facturación / cobro al paciente.
- App móvil nativa (el formulario del paciente ya es web responsive de alta calidad).
- Agrupación multi-clínica con administración compartida.
- Biblioteca de presets compartibles entre anestesiólogos.
- Segundo idioma (arquitectura ya preparada).

---

## 5. Usuarios y roles

> **Modelo confirmado:** plataforma **multi-anestesiólogo**. La unidad principal es el **perfil del anestesiólogo** (workspace propio), no un formulario global compartido. Cada anestesiólogo hace *sign in*, gestiona su propio branding (logo de clínica + firma), sus propios **presets de formulario** y envía sus propios formularios de forma independiente de los demás médicos de la plataforma. Agrupación por clínica queda como capa opcional a futuro.

| Rol | Descripción | Permisos clave |
|---|---|---|
| **Anestesiólogo** | Usuario principal con **workspace propio**. Configura su perfil (logo de clínica, firma), crea presets de formulario, envía cuestionarios, revisa, edita, aprueba, firma y distribuye. | Gestionar perfil/branding, crear presets, crear caso, aprobar, firmar, distribuir |
| **Paciente** | Responde el cuestionario y carga sus exámenes. No requiere cuenta. | Acceso por enlace tokenizado de un solo caso |
| **Administrador de clínica** | Gestiona anestesiólogos, logo institucional, plantillas de diseño y cuentas. | Gestión de tenant, usuarios, branding |
| **Destinatario** (clínica / aseguradora) | Recibe el documento final por enlace/correo (sin cuenta). | Descarga del documento aprobado |
| **Auxiliar / asistente** *(opcional)* | Apoya en el envío y seguimiento; no puede aprobar. | Crear/enviar caso, seguimiento (sin aprobación) |

---

## 6. Flujo de usuario (end-to-end)

```
[Anestesiólogo] Crea caso y selecciona/edita cuestionario
        │
        ▼
[Plataforma] Genera enlace seguro → envía al paciente (WhatsApp/correo)
        │
        ▼
[Paciente] Responde cuestionario + carga laboratorios/ECG/eco (móvil)
        │
        ▼
[Motor de labs] Extrae valores → compara con rangos → marca alertas rojas
        │
        ▼
[Motor clínico IA] Interpreta respuestas + labs → IMC, ASA, diagnóstico,
        borrador de concepto/plan/recomendaciones → JSON estructurado
        (examen físico y signos vitales = PENDIENTE, no inventados)
        │
        ▼
[Plataforma] Renderiza borrador PDF con Diseño Oficial → estado "Pendiente revisión"
        │
        ▼
[Anestesiólogo] Revisa: validación de campos, alertas, datos inferidos
        │  ├─ Edita campos si es necesario
        │  ├─ Rechaza / solicita más info al paciente
        │  └─ Aprueba y firma  ──────────────┐
        │                                     ▼
        │                          [Plataforma] Bloquea versión, aplica firma,
        │                          timestamp, genera PDF final inmutable
        ▼
[Anestesiólogo] Selecciona destinatarios → distribuye (paciente/clínica/aseguradora)
        │
        ▼
[Plataforma] Registra entrega + acceso (audit log) → estado "Entregado"
```

---

## 7. Requisitos funcionales por módulo

### Módulo 1 — Constructor y gestión de cuestionarios (presets por anestesiólogo)

- **RF-1.1** Cuestionario **base preanestésico** precargado (las 22 preguntas del Anexo A), editable, mapeado 1:1 a los campos del documento.
- **RF-1.2** **Presets de formulario propios de cada anestesiólogo:** cada médico puede crear, nombrar y guardar múltiples plantillas (p. ej. *"Preanestésica general"*, *"Rinoplastia"*, *"Cirugía cardiovascular"*, *"Pediátrica"*), partiendo del base o desde cero.
- **RF-1.3** Los presets son **privados por perfil** — no se comparten automáticamente entre médicos de la plataforma. (Opción futura: biblioteca de plantillas compartibles.)
- **RF-1.4** Tipos de pregunta: texto corto, texto largo, selección única, selección múltiple, fecha, número, sí/no, **carga de archivo** (labs/ECG/eco/imágenes).
- **RF-1.5** Lógica condicional (p. ej. "¿fuma? → nº de cigarrillos/día"; "¿enfermedad? → ¿cuál?").
- **RF-1.6** Marcado de preguntas obligatorias.
- **RF-1.7** Al crear un caso, el anestesiólogo **elige cuál de sus presets enviar**.
- **RF-1.8** Captura obligatoria de **autorización de tratamiento de datos sensibles** (Ley 1581) al inicio del formulario del paciente.
- **RF-1.9** Versionado de cada preset (para no romper casos ya enviados al editar la plantilla).

### Módulo 2 — Distribución al paciente

- **RF-2.1** Generación de **enlace seguro tokenizado** por caso, con expiración configurable. La plataforma muestra el enlace con un botón de **copiar/compartir**.
- **RF-2.2** **Distribución al paciente en modo piloto = manual:** el anestesiólogo copia el enlace del formulario desde la plataforma y **lo envía él mismo por su propio WhatsApp** (o el canal que prefiera). No se integra la WhatsApp Business API en el piloto. El enlace abre el formulario nativo dentro de la plataforma, donde el paciente responde y **adjunta sus exámenes** (labs, ECG, eco, imágenes). *(Automatización del envío por WhatsApp Business API = mejora posterior.)*
- **RF-2.3** Recordatorios automáticos si el paciente no completa en X horas.
- **RF-2.4** Formulario **nativo de la plataforma, responsive mobile-first y con diseño atractivo/branded** (logo del anestesiólogo). **Reemplaza por completo Google Forms.** No se usa Sheets como front del paciente.
- **RF-2.5** Las respuestas se almacenan en la **base de datos de la plataforma (PostgreSQL) como fuente única de verdad**. Exportación/sincronización a Google Sheets disponible como opción secundaria si el anestesiólogo la desea (no es el almacén principal).
- **RF-2.6** Guardado parcial de respuestas (retomar más tarde desde el mismo enlace de WhatsApp).

### Módulo 3 — Captura de respuestas y paraclínicos

- **RF-3.1** Recepción estructurada de respuestas.
- **RF-3.2** Carga múltiple de archivos: PDF, JPG/PNG, capturas de pantalla, fotos.
- **RF-3.3** Clasificación del tipo de documento cargado (hemograma, coagulación, ECG, ecocardiograma, otro).
- **RF-3.4** Validación de completitud antes de disparar la generación.

### Módulo 4 — Motor de análisis de laboratorios (Lab Intelligence)

- **RF-4.1** Extracción de valores desde PDF/imagen (OCR + parsing estructurado).
- **RF-4.2** **Nunca fabricar valores**: solo se registran valores efectivamente presentes en el documento fuente.
- **RF-4.3** Comparación contra rangos de referencia configurables (por sexo/edad).
- **RF-4.4** Detección y marcado de **alertas rojas** clínicamente relevantes para anestesia. Ejemplos:
  - Anemia (Hb baja), poliglobulia (Hb alta)
  - Trombocitopenia / trombocitosis (plaquetas)
  - Coagulopatía (INR/TP/TPT prolongados)
  - Leucocitosis / leucopenia
  - Alteraciones de glucemia, función renal (creatinina), electrolitos
- **RF-4.5** **Trazabilidad de la fuente**: cada valor extraído debe poder mostrarse junto a la porción del documento original de donde se obtuvo (para verificación humana).
- **RF-4.6** Detección de **agonistas GLP-1** (semaglutida, etc.) declarados por el paciente → activación automática de la lógica de **riesgo de vaciamiento gástrico / broncoaspiración** y recomendaciones de ayuno (feature ya demostrada en la plantilla actual).

### Módulo 5 — Motor clínico de IA (Prompt Maestro Engine)

- **RF-5.1** El **Prompt Maestro Ampliado (v2, Anexo D)** se convierte en el system prompt del motor, con la jerarquía documental definida (Prompt Maestro > Manual Clínico > Manual de Diseño > Diseño Oficial > Registro de Cambios).
- **RF-5.2** Entradas: respuestas estructuradas del paciente + valores de laboratorio extraídos + notas del anestesiólogo.
- **RF-5.3** **Salida estructurada (JSON con esquema Zod vía `generateObject` del Vercel AI SDK)** que mapea a los campos del documento, no texto libre. El esquema Zod es el mismo contrato que valida la respuesta: cualquier salida mal formada o que pueble campos prohibidos se rechaza automáticamente. Garantiza consistencia y fidelidad al Diseño Oficial.
- **RF-5.4** Traducción automática de lenguaje coloquial a **terminología médica**.
- **RF-5.5** **Principio rector: no se infiere ningún hallazgo clínico sin sustento** (dato declarado por el paciente, valor extraído de un examen, o valor medido/confirmado por el anestesiólogo). La IA puede **derivar/clasificar** a partir de datos reales, pero **no fabricar mediciones**.
- **RF-5.5a** La IA **puede derivar** (todo con base en datos reales): IMC (cálculo determinístico desde peso/talla), diagnóstico preoperatorio (desde el procedimiento), ASA (desde antecedentes/labs reales), y **borrador** de plan y concepto anestésico.
- **RF-5.5b** La IA **NO genera** signos vitales ni examen físico "normales" por defecto. Estos campos quedan en estado **"pendiente de examen"** hasta que el anestesiólogo los ingrese o confirme con base en un examen real (ver §17). *(Esto ajusta la regla de "inferir signos vitales/examen físico normales" del Prompt Maestro y debe quedar registrado en el Registro de Cambios del proyecto.)*
- **RF-5.6** **Prohibido inventar** en todo caso: antecedentes, medicamentos, alergias, resultados diagnósticos, laboratorios, complicaciones, signos vitales y hallazgos del examen físico.
- **RF-5.7** Todo dato **derivado por IA** (IMC, ASA, diagnóstico, borrador de plan/concepto) se marca visualmente para revisión del anestesiólogo.
- **RF-5.8** Cálculo determinístico de IMC (no dependiente del LLM) a partir de peso/talla.
- **RF-5.9** Generación de **recomendaciones** contextuales (ayuno, dieta líquida, manejo de estómago lleno, etc.) coherentes con las alertas detectadas.
- **RF-5.10** Estilo de redacción: médico, elegante, institucional, claro, conciso. Prohibidas expresiones de IA ("según la información proporcionada", "se sugiere", "parece", "podría").

### Módulo 6 — Renderizado del documento (Diseño Oficial)

- **RF-6.1** Motor de plantilla determinístico (HTML→PDF) que reproduce **exactamente** el Diseño Oficial (ver Anexo C): encabezado con logo, secciones, tablas con banda de color, firma inferior con nombre y título del anestesiólogo.
- **RF-6.2** Una sola página cuando sea posible.
- **RF-6.3** Inserción de la nota estándar de examen físico: *"Examen físico y signos vitales verificados/ingresados por el anestesiólogo tratante."* (o, mientras estén pendientes en el borrador, el documento no se puede aprobar ni renderizar como final).
- **RF-6.4** Paginación y pie de página institucional.
- **RF-6.5** Branding **por anestesiólogo** (logo de clínica y firma tomados de su perfil).
- **RF-6.6** El Diseño Oficial se extiende para incluir los campos nuevos del formulario: **grupo sanguíneo**, **antecedentes transfusionales** y **prótesis dental / diseño de sonrisa** (esta última reflejada en vía aérea).

### Módulo 7 — Revisión y aprobación (HITL)

- **RF-7.1** Vista de revisión lado a lado: borrador generado + respuestas fuente + labs extraídos.
- **RF-7.2** **Validación bloqueante**: no permite aprobar si hay campos obligatorios vacíos.
- **RF-7.3** Resaltado de: campos inferidos por IA, alertas de laboratorio, inconsistencias detectadas, información faltante.
- **RF-7.4** Edición en línea de cualquier campo antes de aprobar.
- **RF-7.5** Acciones: **Aprobar y firmar**, **Editar**, **Rechazar/solicitar más info** (reabre el formulario al paciente).
- **RF-7.6** Al aprobar: se **bloquea la versión**, se aplica la firma, se registra timestamp y usuario aprobador → PDF final **inmutable**.

### Módulo 8 — Distribución del documento final

- **RF-8.1** Selección de destinatarios **desde el directorio de contactos** (Módulo 12): paciente, clínica, aseguradora, médicos u otros — se seleccionan, no se escriben a mano. Permite alta rápida de contactos nuevos.
- **RF-8.2** Envío del PDF final por enlace seguro / correo.
- **RF-8.3** **Registro de entrega y acceso** (quién, cuándo, si fue abierto) en el audit log.
- **RF-8.4** Reenvío controlado (solo desde la versión aprobada e inmutable).

### Módulo 9 — Dashboard de gestión de casos

- **RF-9.1** Estados: `Borrador` → `Enviado al paciente` → `Respondiendo` → `Respuestas recibidas` → `Labs analizados` → `Borrador generado` → `Pendiente de revisión` → `Aprobado` → `Entregado`.
- **RF-9.2** Filtros por estado, fecha, paciente, procedimiento.
- **RF-9.3** Indicadores: casos pendientes de revisión, con alertas rojas, próximos a fecha de cirugía.
- **RF-9.4** Búsqueda por nombre/documento del paciente.

### Módulo 10 — Perfil del anestesiólogo y administración

- **RF-10.1** **Modo piloto:** un **perfil único sembrado ("Luquetta")** con sign in simple, sin flujo de registro ni creación masiva de logins todavía. La arquitectura de datos se mantiene lista para multi-anestesiólogo (workspace), pero el sistema de autenticación completo (registro, RBAC, invitaciones) es una fase posterior.
- **RF-10.2** **Perfil / branding por anestesiólogo:**
  - Carga de la **foto/logo de la clínica** → se coloca en el encabezado del PDF generado.
  - Carga de la **firma digital (imagen)** → se pega automáticamente en el bloque de firma del PDF.
  - Datos del profesional (nombre, título/especialidad, registro médico) para el bloque de firma.
  - Datos de pie de página (contacto de la clínica).
- **RF-10.3** Gestión de **presets de formulario** propios (ver Módulo 1).
- **RF-10.4** Gestión de rangos de referencia de laboratorio (por defecto globales, ajustables por perfil).
- **RF-10.5** RBAC (anestesiólogo, admin, auxiliar).
- **RF-10.6** Versionado del motor clínico (Prompt Maestro / Manual Clínico) — global, con posibilidad de override por perfil a futuro.
- **RF-10.7** *(Futuro)* Agrupación de anestesiólogos bajo una **clínica** con branding y administración compartida.

### Módulo 11 — Base de datos e historial de pacientes (por perfil)

- **RF-11.1** Cada anestesiólogo tiene su **base de datos de pacientes propia** dentro de su workspace.
- **RF-11.2** El paciente se crea/actualiza automáticamente al procesar un caso (a partir de los datos del formulario), sin recaptura manual.
- **RF-11.3** **Consulta por historial:** búsqueda por número de identificación, nombre u otro campo (aseguradora, procedimiento, fecha).
- **RF-11.4** Ficha del paciente con su **historial de valoraciones**: todas las valoraciones previas (con fecha, procedimiento, ASA, estado y PDF final descargable).
- **RF-11.5** Al crear un caso nuevo para un paciente existente, **precarga** sus datos base (nombre, documento, nacimiento, sexo, aseguradora, grupo sanguíneo) y antecedentes conocidos, marcándolos para reconfirmación por el paciente.
- **RF-11.6** Vista de evolución: comparar antecedentes/medicación/labs entre valoraciones del mismo paciente.
- **RF-11.7** Aislamiento por perfil: un anestesiólogo **no ve** los pacientes de otro (privacidad y Ley 1581).

### Módulo 12 — Directorio de destinatarios (contactos)

- **RF-12.1** Cada anestesiólogo mantiene su **directorio de contactos** para el envío de reportes (médicos, clínicas, aseguradoras, pacientes frecuentes).
- **RF-12.2** Cada contacto guarda: **nombre/etiqueta**, **correo**, tipo (médico / clínica / aseguradora / otro) y notas.
  - *Ej.:* `Doctor Lozano — d.lozano@auna.com` · `Clínica Portoazul — karen.garcia@clinicaportoazul.com`
- **RF-12.3** Al distribuir un documento (Módulo 8), el anestesiólogo **selecciona destinatarios del directorio** en lugar de escribir correos a mano; puede elegir varios a la vez.
- **RF-12.4** Alta rápida de un contacto nuevo desde la pantalla de envío (queda guardado para próximas veces).
- **RF-12.5** La **aseguradora capturada en el formulario (P8)** se sugiere automáticamente como destinatario y puede vincularse a un contacto del directorio.
- **RF-12.6** Directorio **privado por perfil**.

---

## 8. Requisitos no funcionales

| Categoría | Requisito |
|---|---|
| **Seguridad** | Cifrado en tránsito (TLS) y en reposo; RBAC; sesiones seguras; enlaces del paciente tokenizados y expirables; sin credenciales por WhatsApp/correo |
| **Privacidad** | Cumplimiento **Ley 1581/2012** y Decreto 1377 (dato sensible en salud): consentimiento explícito, minimización, finalidad, derecho de acceso/actualización/supresión |
| **Historia clínica** | Alineación con Resolución 1995/1999 y Ley 2015/2020 (retención, integridad, no alteración post-firma) |
| **Auditoría** | Log inmutable de todas las acciones (creación, edición, aprobación, entrega, acceso) |
| **Disponibilidad** | ≥ 99.5% |
| **Rendimiento** | Extracción + análisis de labs < 30 s; generación de borrador < 20 s |
| **Escalabilidad** | Arquitectura multi-tenant lista para múltiples clínicas |
| **Trazabilidad de IA** | Cada dato inferido/extraído es rastreable a su fuente; versionado de prompts |
| **Idioma** | Español (con arquitectura lista para bilingüe si se expande a otro mercado) |

---

## 9. Arquitectura técnica propuesta

> **Stack confirmado:** el mismo de *Knowledge Intelligence (KI)*, para mantener coherencia con tu portafolio y aprovechar el conocimiento del equipo. TypeScript de punta a punta (Angular + Next.js + Zod), PostgreSQL con pgvector, Prisma y Vercel AI SDK. Sin contenedores, instalación LTS.

```
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND (Angular 19+)                     │
│  Panel anestesiólogo (standalone/signals)  │  Form paciente  │
│  dashboard · revisión · aprobación         │  (mobile-first) │
└───────────────┬─────────────────────────────────┬───────────┘
                │        Zod (contratos)           │
        ┌───────▼──────────────────────────────────▼─────────┐
        │            BACKEND — Next.js API Routes             │
        │  Auth/RBAC · Casos · Cuestionarios · Distribución   │
        │  Prisma (ORM) · Zod (validación end-to-end)         │
        └───┬──────────┬───────────┬───────────────┬─────────┘
            │          │           │               │
   ┌────────▼──┐ ┌─────▼──────┐ ┌──▼───────────┐ ┌─▼──────────┐
   │ PostgreSQL│ │ Lab Engine │ │ Clinical AI  │ │ PDF Render │
   │ +pgvector │ │ Claude     │ │ Vercel AI SDK│ │ Playwright │
   │ (Prisma)  │ │ visión     │ │ + Anthropic  │ │ (HTML→PDF) │
   │           │ │ +red flags │ │ generateObject│ │ Diseño Of. │
   └───────────┘ └────────────┘ └──────────────┘ └────────────┘
            │            │
   ┌────────▼───────────┐│  ┌──────────────────┐  ┌───────────────┐
   │ Object storage     ││  │ Cola de trabajos │  │ Notificaciones│
   │ (labs, PDFs, firma)││  │ pg-boss (Postgres)│  │ WhatsApp/correo│
   └────────────────────┘   └──────────────────┘  └───────────────┘
```

**Componentes clave (stack KI):**
- **Frontend:** Angular 19+ (standalone components, signals, zoneless) — panel del anestesiólogo y formulario del paciente.
- **Backend:** Next.js (API Routes) en `/api/...`, TypeScript.
- **Validación:** Zod de punta a punta (los mismos esquemas Zod definen el contrato de salida de la IA).
- **ORM / BD:** Prisma sobre PostgreSQL + pgvector, sin contenedores, instalación LTS.
- **Motor de IA:** **Vercel AI SDK** con proveedor Anthropic (Claude). Se usa `generateObject` con un esquema Zod para forzar la **salida estructurada** del Prompt Maestro Ampliado (Anexo D) y rechazar salidas mal formadas automáticamente.
- **Motor de labs:** **Claude con visión vía Vercel AI SDK** para extraer valores directamente de PDF/imagen (más robusto que OCR tradicional), + reglas de rangos determinísticas (alertas rojas) + trazabilidad a la fuente.
- **Renderizado PDF:** **Playwright** (headless Chromium) — ya presente en el stack de KI — sobre plantilla HTML/CSS fiel al Diseño Oficial (Anexo C).
- **Cola de trabajos:** **pg-boss** (respaldada en PostgreSQL, sin infraestructura extra) para el pipeline event-driven; alternativa BullMQ+Redis si se prefiere.
- **Parseo de archivos:** `xlsx` (npm) para adjuntos tabulares; manejo de PDF/imagen para paraclínicos.
- **Almacenamiento:** object storage cifrado (URLs firmadas y expirables) para adjuntos, PDFs firmados y firmas.
- **Charts/dashboard:** Chart.js (mismo de KI) para indicadores del panel.
- **Notificaciones:** en el piloto, enlace **compartible manualmente** (el anestesiólogo lo envía por su WhatsApp) + correo para el reporte final. WhatsApp Business Cloud API = automatización posterior.
- **Firma certificada:** integración con una ECD acreditada por ONAC con estampado cronológico (ver §13).

### 9.1 Orquestación y disparadores del flujo (event-driven)

**¿Cómo sabe el sistema que el paciente ya respondió?** Como el formulario es **nativo de la plataforma** (no un Google Form externo), no hace falta un *watcher* que esté sondeando la base de datos buscando registros nuevos. El envío del formulario es un **evento directo dentro del sistema**: cuando el paciente presiona "Enviar", el backend recibe la petición, persiste las respuestas en una transacción y **emite un evento** (`form.submitted`) que dispara automáticamente el resto del pipeline.

```
Paciente presiona "Enviar"
        │
        ▼
[API] Persiste FormResponse + Attachments (transacción)  → evento: form.submitted
        │
        ▼
[Orquestador] Encola el pipeline del caso:
        1. lab.extract        → extrae valores de los adjuntos
        2. lab.flag           → compara con rangos → alertas rojas
        3. clinical.generate  → Prompt Maestro → JSON estructurado (examen físico = pendiente)
        4. document.render     → borrador PDF (Diseño Oficial)
        │
        ▼
[Notificación] Al anestesiólogo (in-app + WhatsApp/correo):
        "Nuevo caso listo para revisión: [paciente]"  → estado: Pendiente de revisión
```

**Principios de la orquestación:**
- **Event-driven, no polling:** el disparador es el submit, no un sondeo periódico. (Un *watcher*/polling solo tendría sentido si la fuente fuera externa, p. ej. si se mantuviera Google Sheets — que precisamente se elimina.)
- **Cola de trabajos asíncrona (pg-boss):** la extracción de labs y la generación clínica corren en background (workers sobre PostgreSQL, sin infraestructura extra), para no bloquear al paciente ni al anestesiólogo. Estados intermedios visibles en el dashboard.
- **Idempotencia y reintentos:** cada paso es reintentable ante fallos (OCR, API de IA) sin duplicar el caso.
- **Notificación push al anestesiólogo:** apenas el borrador está listo, se le avisa; no tiene que estar revisando manualmente si llegó algo.
- **Guardado parcial:** si el paciente guarda sin enviar, no se dispara el pipeline; solo el submit final lo hace.

> Si en algún momento se habilita la exportación opcional a Google Sheets, esa sincronización es un **paso posterior** del pipeline (downstream), nunca la fuente de verdad ni el disparador.

---

## 10. Modelo de datos (entidades principales)

| Entidad | Descripción / campos clave |
|---|---|
| `Anesthesiologist` (workspace) | Perfil principal. Credenciales, nombre, especialidad, registro médico, **logo de clínica**, **firma gráfica**, pie de página |
| `User` | Cuenta de acceso (anestesiólogo / admin / auxiliar). Rol, credenciales |
| `Clinic` *(futuro)* | Agrupación opcional de anestesiólogos con branding compartido |
| `Patient` | Nombre, documento, fecha nacimiento, sexo, teléfono, aseguradora, grupo sanguíneo. **Pertenece a un anestesiólogo**; su historial son sus `Case` |
| `DirectoryContact` | Contacto de envío propiedad del anestesiólogo: nombre/etiqueta, correo, tipo (médico/clínica/aseguradora/otro), notas |
| `QuestionnairePreset` / `Question` | Preset **propiedad de un anestesiólogo**, nombre, preguntas, tipos, lógica condicional, versión |
| `Case` (Valoración) | Estado, paciente, anestesiólogo, procedimiento, fechas, tenant |
| `FormResponse` | Respuestas del paciente a un caso |
| `Attachment` | Archivo cargado (tipo, url, hash) |
| `ExtractedLabResult` | Analito, valor, unidad, rango, flag (normal/alerta), fuente |
| `GeneratedAssessment` | Campos estructurados del documento (concepto, plan, ASA, IMC, examen físico, recomendaciones), flags de inferido |
| `ApprovalRecord` | Aprobador, timestamp, versión bloqueada, edits aplicados |
| `DeliveryRecord` | Destinatario, canal, fecha envío, fecha acceso |
| `AuditLog` | Acción, actor, entidad, timestamp (inmutable) |
| `Consent` | Autorización Ley 1581 del paciente, timestamp, texto/versión |

---

## 11. Integración de IA (prompt engineering)

- **11.1** El Prompt Maestro provisto se usa como **system prompt canónico**; los Manuales (Clínico, Diseño) y el Registro de Cambios se cargan como contexto/reglas versionadas por tenant.
- **11.2** El modelo devuelve un objeto validado por **esquema Zod** (`generateObject`, Vercel AI SDK). El esquema rechaza salidas que lo violen o que intenten poblar campos prohibidos de inferir.
- **11.3** **Guardarraíles anti-alucinación:**
  - Los campos de antecedentes/medicamentos/alergias/labs se poblan **solo** desde entradas verificadas (respuestas del paciente o extracción de labs), nunca generados.
  - IMC calculado por código, no por el modelo.
  - Cualquier inferencia se etiqueta como tal.
- **11.4** **Detección de inconsistencias e información faltante** → se reportan al revisor, no se rellenan silenciosamente.
- **11.5** Versionado y trazabilidad de prompts: cada documento guarda qué versión del prompt/modelo lo generó.
- **11.6** **Estrategia sin key (desarrollo):** todas las llamadas al LLM viven detrás de un **adaptador** (el propio Vercel AI SDK ya lo facilita). Mientras no haya key, un **stub** devuelve un JSON de ejemplo (p. ej. el caso de referencia del Anexo C), de modo que todo lo *aguas abajo* —render del PDF, pantalla de revisión, aprobación, distribución— se construye y se prueba de punta a punta. Cuando entra la key de Anthropic, se cambia el stub por la llamada real (**un solo punto de cambio**).
- **11.7** **Funciones que dependen de la key** (solo estas quedan a la espera de output real): (a) la **extracción de valores de laboratorio por visión** (Módulo 4) y (b) el **motor clínico** completo (Módulo 5: interpretación, ASA, concepto, plan, recomendaciones, lógica GLP-1). El resto del sistema no depende del LLM.

---

## 12. Seguridad clínica y consideraciones regulatorias

- **12.1** **HITL obligatorio:** ningún documento se finaliza ni distribuye sin aprobación explícita del anestesiólogo. La IA nunca autoenvía.
- **12.2** El **anestesiólogo es el responsable clínico y legal** del documento firmado; la plataforma es una herramienta de apoyo a la documentación, no un dispositivo de diagnóstico autónomo.
- **12.3** Nota estándar de corroboración de datos inferidos siempre presente en el documento.
- **12.4** Consentimiento informado de tratamiento de datos sensibles capturado antes de cualquier recolección (Ley 1581).
- **12.5** Retención, integridad e inmutabilidad post-firma conforme a normativa de historia clínica.
- **12.6** **Examen físico y signos vitales:** no se infieren sin sustento. Quedan "pendiente de examen" y el anestesiólogo los ingresa o confirma antes de aprobar (regla estricta, ver §17). Ningún valor fisiológico llega al PDF sin respaldo real.

---

## 13. Firma del documento

- **Firma visual (mecanismo estándar):** el anestesiólogo sube una imagen de su firma (PNG/PDF) en su perfil y el sistema la **inserta automáticamente** en el bloque de firma del PDF al aprobar, junto con nombre, especialidad y registro médico. Es lo que necesita el producto para el uso clínico y operativo.
- **Trazabilidad por plataforma (sustituye la criptografía para uso operativo):** la versión aprobada queda **bloqueada e inmutable**, con registro de quién aprobó y cuándo en el audit log. Esto da un rastro sólido sin necesidad de firma criptográfica.
- **Firma digital certificada (opcional, según el receptor):** capa adicional que se activa **solo si** una aseguradora, clínica o proceso legal exige validez probatoria plena (no repudio + detección de alteración criptográfica). Integra una ECD acreditada por ONAC con estampado cronológico. No forma parte del núcleo del producto.

---

## 14. Roadmap de implementación (AI-DLC)

| Fase | Entregable | Alcance |
|---|---|---|
| **Fase 0 — Fundaciones** | Repo + `CLAUDE.md` + esquema de datos + auth/RBAC + tenant | Base del proyecto |
| **Fase 1 — Captura** | Constructor de presets + form paciente responsive + carga de archivos + consentimiento + **perfil/branding** | Reemplaza el Google Form |
| **Fase 2 — Lab Intelligence** | Extracción de labs + rangos + alertas rojas + trazabilidad de fuente | Automatiza el análisis manual |
| **Fase 3 — Motor clínico** | Prompt Maestro Engine + salida JSON + guardarraíles + cálculo IMC/ASA | Corazón de la IA |
| **Fase 4 — Documento** | Renderizado PDF fiel al Diseño Oficial + firma + branding | Reemplaza el armado manual |
| **Fase 5 — HITL** | Bandeja de revisión + validación + aprobación + inmutabilidad | Control de calidad |
| **Fase 6 — Distribución y expedientes** | Envío a destinatarios vía **directorio de contactos** + trazabilidad + dashboard de casos + **base de datos e historial de pacientes** (búsqueda y ficha) | Cierre del ciclo |
| **Fase 7 — Hardening** | Auditoría, seguridad, cumplimiento, pruebas, multi-tenant pulido | Producción |

*Siguiente paso recomendado tras aprobar este PRD: generar el `CLAUDE.md` y el esquema de datos para arrancar Fase 0 con Claude Code.*

---

## 15. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Alucinación de datos clínicos por el LLM | Esquema JSON estricto + regla "sin sustento no se genera" + campo `fuente` obligatorio + HITL |
| Error de OCR en laboratorios | Mostrar valor extraído junto a la fuente para verificación; nunca fabricar |
| Valores fisiológicos sin medir en el documento | Examen físico "pendiente de examen"; no se aprueba sin confirmación del anestesiólogo (§17) |
| Responsabilidad legal del documento | Anestesiólogo como firmante responsable; disclaimers; gate de aprobación |
| Manejo de datos sensibles de salud | Cifrado, consentimiento, minimización, auditoría, cumplimiento Ley 1581 |
| Paciente responde de forma incompleta/errónea | Validaciones + lógica condicional + revisión médica |
| Dependencia de un solo anestesiólogo/clínica | Diseño multi-tenant desde el inicio |

---

## 16. Decisiones

### ✅ Resueltas

1. **Modelo de negocio:** plataforma **multi-anestesiólogo**, con workspace, branding (logo + firma) y presets de formulario **propios por perfil**. Agrupación por clínica queda para futuro.
2. **Presets de formulario:** cada anestesiólogo crea y gestiona sus propias plantillas (general, rinoplastia, cardiovascular, etc.) y elige cuál enviar en cada caso.
3. **Branding en el PDF:** logo de clínica + firma digital se cargan en el perfil del anestesiólogo y se insertan automáticamente en el documento.
4. **Canal al paciente:** **WhatsApp** solo para compartir el enlace (WhatsApp Business API), correo como respaldo. No es chatbot pregunta-por-pregunta.
5. **Formulario nativo:** se abandona Google Forms/Sheets. El formulario del paciente es **nativo, atractivo y branded** dentro de la plataforma; las respuestas y adjuntos se guardan en la BD de la plataforma (Sheets solo como export opcional).
6. **Examen físico / signos vitales:** **híbrido con regla estricta** — no se infiere ningún valor sin sustento; queda "pendiente de examen" y el anestesiólogo lo confirma/ingresa antes de aprobar (ver §17).
7. **Enfoque de producto:** sin mentalidad MVP — se construye la plataforma completa.
8. **Disparador del flujo:** event-driven (el submit del formulario dispara el pipeline); sin watcher/polling (ver §9.1).
9. **Stack tecnológico:** el mismo de **Knowledge Intelligence** — Angular 19+ (standalone/signals) · Next.js API Routes · PostgreSQL + pgvector · Prisma · Zod end-to-end · Vercel AI SDK (Anthropic) · Playwright (PDF) · pg-boss (cola). Sin contenedores, instalación LTS.
10. **Firma:** **firma visual** (imagen PNG/PDF) como mecanismo estándar; firma certificada (ECD ONAC) queda como capa **opcional** solo si un receptor la exige.

### ⏳ Pendientes (requieren tu input)

11. **Modo piloto (arranque):** (a) **hosting** se decide luego — desarrollo local LTS, arquitectura cloud-agnóstica; (b) **auth** = cuenta única sembrada, sin registro masivo aún; (c) **envío al paciente** = manual (el anestesiólogo copia el enlace y lo manda por su WhatsApp), sin WhatsApp Business API.

### ⏳ Pendientes (requieren tu input)

12. **Población:** ¿preset **pediátrico** en el lanzamiento o en iteración posterior?
13. **Insumos (se entregan cuando su fase lo pida, no bloquean el arranque):** nombre definitivo del producto, **tabla de rangos de laboratorio** validada por el Dr. Luquetta, y **assets de branding** (logo de clínica, firma PNG, registro médico). **LLM:** se usará Claude (Anthropic) vía **key que el usuario proveerá más adelante**; hasta entonces se desarrolla con un stub (ver §11.6). Modelo objetivo: Opus para el razonamiento clínico.

---

## 17. Nota de diseño — Examen físico y signos vitales

**El problema.** Un formulario que el paciente responde por WhatsApp puede capturar antecedentes, medicación, alergias y hábitos, pero **no puede medir** la tensión arterial, la frecuencia cardíaca, ni auscultar el corazón o evaluar la vía aérea (Mallampati, distancia tiromentoniana, etc.). Esos datos requieren un examen presencial. Hoy, el sistema los **infiere como "normales"** y los rellena en el documento con una nota de que deben corroborarse.

**Por qué importa.** El documento es un registro clínico firmado. Rellenar automáticamente "TA 124/78, Mallampati I, ruidos cardíacos sin soplos" sin que nadie lo haya medido significa **introducir datos fabricados** en un documento médico-legal. Si el paciente tuviera realmente hipertensión no controlada o una vía aérea difícil, un "normal" inventado podría **enmascarar el hallazgo** y pasar al procedimiento sin alerta. Es justo el tipo de dato que el propio Prompt Maestro prohíbe inventar, y por eso la plantilla ya lleva la advertencia de corroboración.

**Las tres opciones:**

| Opción | Cómo funciona | Pro | Contra |
|---|---|---|---|
| **A. Inferido-marcado** (actual) | La IA rellena valores normales, etiquetados "inferido — verificar" | Rápido; documento se ve completo | Datos fabricados en registro clínico; riesgo de aprobar sin medir; posible responsabilidad |
| **B. Captura manual obligatoria** | El anestesiólogo escribe los valores reales antes de generar/aprobar | Máxima exactitud; sin invención | Más fricción; el examen suele ocurrir en otro momento que el formulario |
| **C. Híbrido (recomendado)** | El borrador deja el examen **"pendiente"** (no inventa). En la revisión, el anestesiólogo confirma "examen normal" con un clic o edita los valores reales. No se puede aprobar sin esa acción | No fabrica datos; sigue siendo ágil; exige una confirmación activa | Un paso más en la revisión (mínimo) |

**Decisión confirmada:** Opción **C (híbrido), con regla estricta: no se infiere ningún signo vital ni hallazgo físico sin sustento.** El borrador deja el examen físico y los signos vitales en estado **"pendiente de examen"** (nunca valores inventados). En la revisión, el anestesiólogo ingresa los valores reales o los confirma con base en un examen; hay un botón "cargar examen normal" para agilizar el caso típico, pero **el documento no se puede aprobar mientras el examen siga pendiente**. Así se conserva la velocidad y ningún valor fisiológico llega al PDF sin respaldo real.

> Los antecedentes, medicación, alergias, labs y GLP-1 **no** se ven afectados: provienen de datos reales declarados o extraídos. Lo que sí puede derivar la IA (con base en esos datos reales) es IMC, ASA, diagnóstico preoperatorio y el borrador de plan/concepto.

---

## Anexo A — Formulario completo (22 preguntas) → Documento

Cuestionario base confirmado. Cada pregunta se mapea a un campo del documento clínico. Se marcan con ⭐ los **campos nuevos** respecto de la plantilla actual y con 🫁 los de **relevancia directa para la vía aérea/anestesia**.

| # | Pregunta del formulario | Sección documento | Tipo | Notas |
|---|---|---|---|---|
| 1 | Nombre completo | Paciente | Texto | Obligatorio |
| 2 | Nº de documento | Documento | Texto | Obligatorio |
| 3 | Fecha de nacimiento | Edad | Fecha → derivada | Calcula edad |
| 4 | Sexo | Sexo | Selección | Ajusta rangos de labs |
| 5 | Peso (kg) | Peso / IMC | Número | → IMC calculado |
| 6 | Estatura (cm) | Talla / IMC | Número | ⚠️ convertir cm→m para el PDF |
| 7 | Teléfono de contacto | Contacto paciente | Texto | Canal de notificación |
| 8 | ⭐ Entidad aseguradora | Aseguradora / **destinatario** | Texto | Alimenta la distribución (§8) |
| 9 | Cirugía o procedimiento | Procedimiento | Texto | |
| 10 | Fecha de cirugía | Fecha del procedimiento | Fecha | Prioriza casos por urgencia |
| 11 | ⭐ Grupo sanguíneo | Grupo sanguíneo | Selección | Nuevo campo en el documento |
| 12 | ¿Sufre alguna enfermedad? | Antecedentes patológicos | Sí/No | Gatilla P13 |
| 13 | Patologías (checklist: HTA, DM, hipo/hipertiroidismo, arritmia, IAM, EPOC, asma, HTP, apnea del sueño, litiasis/infección/insuf. renal, gastritis, migraña, art., otra) | Antecedentes patológicos | Selección múltiple | 🫁 apnea del sueño y HTP → riesgo anestésico |
| 14 | ¿Toma medicamentos? | Medicamentos | Texto | Detección **GLP-1** aquí |
| 15 | ¿Alergias? | Alergias | Texto | |
| 16 | ¿Cirugías/anestesias previas? | Ant. quirúrgicos / anestésicos | Texto | |
| 17 | ⭐ ¿Transfusiones previas? | Ant. transfusionales | Sí/No + detalle | Nuevo en el documento |
| 18 | ¿Sustancias psicoactivas? | Hábitos | Sí/No | |
| 19 | ¿Alcohol? | Hábitos | Sí/No | |
| 20 | ¿Fuma/vapea? | Hábitos | Sí/No | Gatilla P21 |
| 21 | Cantidad de cigarrillos/vapeo por día | Hábitos | Número (condicional) | 🫁 relevancia respiratoria |
| 22 | ⭐ 🫁 ¿Prótesis dental / diseño de sonrisa? | Vía aérea / examen físico | Sí/No + detalle | **Muy relevante** para intubación y protección dental |
| — | Adjuntos | Paraclínicos | Archivo → extracción | Hemograma, coagulación, ECG, eco, etc. |
| — | Examen físico / signos vitales | Examen físico | Inferido (marcado) o manual — *ver §16* | |
| — | Diagnóstico preop · ASA · Concepto · Plan · Recomendaciones · Capacidad funcional | Valoración y plan | IA (HITL) | Generado por el motor clínico |

**Implicaciones de los campos nuevos:**
- **Aseguradora (P8):** se conecta directamente con el Módulo 8 → precarga a la aseguradora como posible destinatario del documento final.
- **Grupo sanguíneo (P11) y transfusiones (P17):** agregar como filas nuevas en la sección *Antecedentes y medicación* del Diseño Oficial.
- **Prótesis dental / diseño de sonrisa (P22):** debe reflejarse en la evaluación de **vía aérea** del examen físico y, cuando aplique, en las recomendaciones (protección dental / riesgo de manipulación de prótesis en intubación). El motor clínico debe considerarlo explícitamente.

---

## Anexo B — Ejemplos de reglas de alerta de laboratorio *(configurables)*

| Analito | Condición de alerta | Relevancia anestésica |
|---|---|---|
| Hemoglobina | < 12 g/dL (♀) / < 13 (♂) o elevada | Anemia / poliglobulia |
| Plaquetas | < 150.000 o < 100.000 (crítico) | Riesgo de sangrado / neuroaxial |
| INR / TP / TPT | Prolongados | Coagulopatía |
| Leucocitos | Leucocitosis / leucopenia | Infección / inmunosupresión |
| Creatinina / TFG | Elevada / TFG baja | Función renal, dosificación |
| Glucemia | Hiperglucemia marcada | Descompensación metabólica |
| GLP-1 declarado | Última dosis reciente | Vaciamiento gástrico / broncoaspiración → ayuno |

> Los rangos se muestran a título ilustrativo y deben ser configurados/validados clínicamente por el anestesiólogo. La plataforma nunca fabrica valores ni emite diagnósticos autónomos.

---

## Anexo C — Diseño Oficial (plantilla de salida del documento)

Esta es la plantilla que el motor debe reproducir **exactamente**. La estructura, el orden de secciones y el estilo son parte del contrato de salida (el LLM llena campos; el renderizador arma el PDF).

### C.1 Estructura del documento (una página)

**Encabezado**
- Logo de la clínica (tomado del perfil del anestesiólogo), alineado a la izquierda.
- Título centrado: **VALORACIÓN PREANESTÉSICA**.
- Subtítulo: *Evaluación preoperatoria para procedimiento electivo* (ajustable según tipo de cirugía).

**Bloque de identificación** (rejilla de 3 columnas)

| Campo | Origen |
|---|---|
| Paciente | Formulario P1 |
| Documento | Formulario P2 |
| Edad / Sexo | P3 (derivada) / P4 |
| Peso / Talla / IMC | P5 / P6 / IMC calculado |
| Diagnóstico preoperatorio | Derivado del procedimiento (IA) |
| Procedimiento | P9 |
| Fecha de valoración | Fecha del sistema |
| Fecha del procedimiento | P10 |
| Capacidad funcional | Derivada / confirmada (METs) |
| Clasificación ASA | Derivada (IA) |
| Tipo de cirugía | Electiva / urgente |
| Condición actual | Sintomático / asintomático |

**Sección — ANTECEDENTES Y MEDICACIÓN** (encabezado con banda de color)

| Fila | Origen |
|---|---|
| Patológicos | P12 / P13 |
| Quirúrgicos | P16 |
| Anestésicos | P16 |
| Medicamentos | P14 |
| Uso de agonistas GLP-1 | Derivado de P14 (con última dosis) |
| Alergias | P15 |
| Grupo sanguíneo ⭐ | P11 |
| Antecedentes transfusionales ⭐ | P17 |
| Prótesis dental / diseño de sonrisa ⭐ | P22 |
| Hábitos | P18–P21 |
| Síntomas actuales | Declarado |

**Sección — PARACLÍNICOS DISPONIBLES** (tabla: Estudio | Resultado relevante)
- Filas dinámicas según lo cargado y extraído (hemograma, coagulación, ECG, ecocardiograma, otros).
- Solo valores realmente presentes en los documentos (nunca fabricados). Las alertas rojas se destacan.

**Sección — EXAMEN FÍSICO**
- Filas: Peso/Talla/IMC · Signos vitales · Vía aérea · Cuello · Cardiovascular/respiratorio · Abdomen · Extremidades · SNC.
- **Estos campos quedan "pendiente de examen" hasta que el anestesiólogo los ingrese/confirme** (regla §17). La vía aérea incorpora lo relevante de P22 (prótesis dental).
- Nota al pie de la sección: *"Examen físico y signos vitales verificados por el anestesiólogo tratante."*

**Sección — VALORACIÓN Y PLAN**
- **Concepto anestésico:** síntesis clínica (IA, con base en datos reales).
- **Plan anestésico:** tipo de anestesia.
- **Recomendaciones:** ayuno, dieta líquida, manejo de riesgo de contenido gástrico (activado por GLP-1), etc.

**Bloque de firma**
- Línea de firma + firma gráfica del anestesiólogo.
- Nombre en mayúsculas · Especialidad · Registro médico.

**Pie de página**
- Texto institucional + paginación "Página X de Y".

### C.2 Estilo visual
- Paleta institucional (encabezados de sección en banda de color; filas con sombreado alterno).
- Tipografía clara, densidad alta pero legible, una sola página cuando sea posible.
- El branding (logo/firma/colores) proviene del perfil del anestesiólogo.

### C.3 Ejemplo de referencia (documento real generado por el flujo actual)

> Caso: Roberto Mario Uribe González — Septoplastia, turbinoplastia y etmoidectomía — ASA II.

- **Identificación:** 41 años, masculino; 108 kg / 1.88 m / IMC 30.6; capacidad funcional ≥4 METs; cirugía electiva; asintomático.
- **Antecedentes:** niega enfermedades; quirúrgicos (apendicectomía, septoplastia, turbinoplastia, osteotomía bilateral de fémur); medicamentos (zopiclona, hidroxicina); **GLP-1: semaglutida, última dosis hace 2-7 días**; niega alergias; niega tabaquismo/alcohol/PSA.
- **Paraclínicos:** hemograma (Hb 15.9, Hto 48.2%, plaquetas 244.000, sin alteraciones relevantes); coagulación (TP 10.4 s, INR 0.97, TPT 29.5 s, en rango).
- **Examen físico:** IMC 30.6; TA 124/78, FC 72, FR 16; vía aérea AO >4 cm, DTM >6 cm, Mallampati I; resto sin hallazgos. *(En la plataforma estos valores quedan pendientes hasta verificación.)*
- **Concepto:** adulto ASA II, ≥4 METs, sin comorbilidades documentadas, labs en rango, obesidad grado I, en tratamiento con semaglutida sin síntomas GI; apto para cirugía electiva condicionado a verificación del riesgo de contenido gástrico residual.
- **Plan:** anestesia general.
- **Recomendaciones:** ayuno de 8 h; dieta líquida 24 h previas; confirmar ausencia de náuseas/vómito/distensión; si no se cumplió la dieta o hay riesgo de vaciamiento gástrico retardado, considerar ecografía gástrica y manejar como estómago lleno o diferir.

Este caso ilustra el diferencial clínico clave del motor: **detección de GLP-1 → riesgo de broncoaspiración → recomendaciones específicas de ayuno**.

---

## Anexo D — Prompt Maestro Ampliado (v2)

> Versión endurecida del Prompt Maestro para el motor de la plataforma. Incorpora la regla de "no inferir sin sustento", el contrato de salida estructurada, los campos nuevos y la lógica clínica. Mantiene la jerarquía documental del proyecto (este prompt > Manual Clínico > Manual de Diseño > Diseño Oficial > Registro de Cambios).

### D.1 Identidad y función
Eres el motor clínico del Sistema Inteligente de Valoración Preanestésica. Tu única función es transformar la información **verificada** (respuestas del paciente + paraclínicos extraídos + datos del anestesiólogo) en una valoración preanestésica de calidad institucional, lista para revisión humana. No emites diagnósticos autónomos ni sustituyes el juicio del anestesiólogo, que es el responsable final.

### D.2 Regla de oro — Sustento obligatorio (anti-alucinación)
1. **Nunca inventes** antecedentes, medicamentos, alergias, laboratorios, resultados diagnósticos, complicaciones, signos vitales ni hallazgos del examen físico.
2. **Todo dato clínico debe tener sustento verificable:** una respuesta declarada por el paciente, un valor extraído de un documento cargado, o un dato ingresado/confirmado por el anestesiólogo.
3. Si un dato no tiene sustento, **no lo generes**: márcalo como `pendiente` o `no_reportado`. La ausencia de información se declara explícitamente, nunca se rellena.
4. **Cita el origen** de cada dato en el campo `fuente` del JSON (p. ej. `formulario:P14`, `lab:hemograma`, `anestesiologo`).

### D.3 Derivaciones permitidas (con base en datos reales)
Puedes **derivar/clasificar** —no inventar— únicamente:
- **IMC:** cálculo determinístico desde peso y talla (convierte cm→m). *(En la práctica lo calcula el sistema, no tú.)*
- **Diagnóstico preoperatorio:** a partir del procedimiento declarado.
- **ASA:** clasificación con base en antecedentes, comorbilidades y labs reales. Justifica brevemente el grado.
- **Concepto y plan anestésico (borrador):** síntesis clínica basada en los datos reales, para revisión del anestesiólogo.
- **Recomendaciones:** derivadas de hallazgos reales (ayuno, dieta, manejo de contenido gástrico, etc.).

### D.4 Examen físico y signos vitales — SIEMPRE pendientes
- **No generes** valores de signos vitales ni hallazgos del examen físico "normales" por defecto.
- Devuelve estos campos con estado `pendiente_examen`.
- En la vía aérea, incorpora como *dato declarado* lo relevante de la prótesis dental / diseño de sonrisa (P22), señalando que debe confirmarse en el examen presencial.

### D.5 Interpretación clínica
- Traduce el lenguaje coloquial del paciente a **terminología médica** precisa.
- Organiza y jerarquiza antecedentes; agrupa por sistemas.
- Interpreta medicamentos y procedimientos declarados.
- **Detecta y reporta** inconsistencias e información faltante (no las corrijas en silencio).
- Resume solo cuando no se pierda información clínicamente relevante.

### D.6 Lógica de laboratorios
- Usa **solo** valores efectivamente presentes en los documentos extraídos.
- Compara contra los rangos de referencia (por sexo/edad) y marca **alertas rojas** (ver Anexo B).
- Refleja las alertas en el concepto y en las recomendaciones cuando sean clínicamente pertinentes.
- Si un estudio no fue cargado, decláralo como `no_disponible`.

### D.7 Lógica GLP-1 / riesgo de broncoaspiración (regla crítica)
- Si el paciente declara un **agonista GLP-1** (semaglutida, liraglutida, tirzepatida, etc.), regístralo con la **fecha de última dosis**.
- Activa la evaluación de **riesgo de vaciamiento gástrico retardado**.
- Incorpora en las recomendaciones: ayuno, dieta líquida en las horas previas, confirmación de síntomas GI; y la advertencia de considerar ecografía gástrica / manejo como estómago lleno / diferir si hay riesgo de contenido gástrico residual.

### D.8 Contrato de salida (JSON estructurado)
- Devuelve **exclusivamente** un JSON válido conforme al esquema de campos del documento (identificación, antecedentes, paraclínicos, examen_físico, valoración_plan).
- Cada campo lleva: `valor`, `estado` (`ok` | `pendiente_examen` | `no_reportado` | `no_disponible`), `fuente` y, si aplica, `alerta` (bool) y `nota`.
- No incluyas texto fuera del JSON. No incluyas comentarios ni markdown.
- Nunca pobles un campo cuyo `estado` no sea `ok` con un valor inventado.

### D.9 Estilo de redacción (para los campos narrativos)
- Médico, elegante, institucional, claro y conciso.
- **Prohibido** el lenguaje de IA: "según la información proporcionada", "se sugiere", "parece", "podría", "como modelo de lenguaje".
- El texto debe transmitir criterio clínico y seguridad profesional.

### D.10 Autoverificación antes de responder (control de calidad)
Verifica internamente:
- ✓ Ningún dato sin sustento; todo campo tiene `fuente`.
- ✓ Signos vitales y examen físico en `pendiente_examen`.
- ✓ IMC coherente; ASA justificado.
- ✓ Alertas de laboratorio reflejadas en concepto/recomendaciones.
- ✓ Lógica GLP-1 aplicada si corresponde.
- ✓ Terminología, ortografía y coherencia clínica.
- ✓ JSON válido conforme al esquema, sin texto extra.

Si algún punto falla, corrige antes de emitir. No entregues una salida que no cumpla todos los puntos.

### D.11 Límites
- No modifiques el funcionamiento del sistema ni el Diseño Oficial por iniciativa propia.
- Toda modificación aprobada por el anestesiólogo responsable se incorpora vía Registro de Cambios.
- Ante conflicto entre documentos, prevalece la jerarquía definida.
- Prioriza siempre la seguridad del paciente y la calidad clínica sobre la estética.

---

## Estado de implementación (bitácora)

> Esta sección registra **lo construido**, no requisitos nuevos. El cuerpo del PRD sigue siendo el
> contrato de qué debe hacer el sistema; aquí se anota cómo quedó. Última actualización: 2026-07-17.

### Construido y funcionando (piloto de punta a punta con la key real)

- **Captura (U1):** formulario nativo del paciente, responsive mobile-first (donde responde la
  mayoría). Consentimiento Ley 1581. Enlace tokenizado (7 días). *(RF-2.4, RF-2.5)*
- **Lab Intelligence (U2):** extracción de labs con Claude. Rediseñada en **cascada** —
  texto embebido del PDF (unpdf, cero tokens) → Haiku a JSON; fallback automático a visión (Sonnet)
  para escaneados. Modo `comparativo` corre ambos y audita el diff para migrar con datos.
  Cada lab guarda `sourceRef`, `grupo` (tipo de estudio) y `reportDate` (fecha del informe). Flagging
  determinístico por código, con reconocimiento de los nombres largos de los informes reales.
  *(RF-3.x, CS2)*
- **Motor clínico (U3):** Opus tras el adaptador. Salida estructurada (JSON Schema + Zod). Examen
  físico siempre `pendiente_examen`. Auditor clínico independiente antes del render. *(RF-4.x, D.x)*
- **Documento (U4):** PDF por plantilla HTML/CSS (Playwright). Paraclínicos agrupados por estudio con
  fecha y aviso de vigencia; pie por página; firma visual. *(RF-5.x, Anexo C)*
- **Revisión/HITL (U5):** el médico edita, ve los exámenes originales (visor de adjuntos) y la ficha
  completa del paciente. Aprobación bloqueada mientras el examen físico esté pendiente. Versión
  aprobada inmutable + audit log. *(RF-6.x, CS1, CS3, CS7)*
- **Distribución (U6):** compositor de correo editable + PDF adjunto; enlace de descarga tokenizado.
  *(RF-7.x)*

### Refuerzos de seguridad clínica (sobre lo ya especificado)

- El "examen normal" atestado por el médico **ya no rellena cifras de signos vitales** (TA/FC/SatO2)
  ni peso/talla: exigen medición, quedan pendientes y bloquean la aprobación. *(CS2, CS3)*
- No se traduce un procedimiento por coincidencia de letras ("lipoma" ≠ liposucción). *(CS2)*
- No se afirma "Niega X" cuando el paciente dejó la pregunta en blanco. *(CS2)*
- El flagging reconoce los nombres largos de los informes reales, para no dar por NORMAL sin evaluar.

### Pendientes conocidos

- ~~Editor de cuestionarios propios~~ — **resuelto el 2026-08-30.** El anestesiólogo añade sus
  propias preguntas (`PR01`–`PR99`) desde *Mis preguntas*; las de la Especificación **no son
  editables** y el servidor sólo escribe filas `PROPIA`, así que una pantalla no puede
  desincronizar el prompt clínico, la trazabilidad ni las variables de las escalas.
- ~~Reconciliador de casos atascados~~ — **ya existe** (`reconciler.service.ts`, corre al arrancar
  el worker). Este documento lo listaba como pendiente por error.
- ~~Decisión sobre la exportación opcional a Google Sheets~~ — **resuelta el 2026-08-30: se elimina.**
  Nunca se configuró (el botón sólo devolvía "no está configurado"), Postgres es la fuente de
  verdad y mantener una credencial de service account viva para una función que nadie usó es
  superficie de riesgo sin contrapartida. Si el Dr. pide un listado, se hace un CSV local sin
  sacar datos de pacientes a Google.
- Rotar la `ANTHROPIC_API_KEY` cuando corresponda. Auditado el 2026-08-30: nunca entró al
  repositorio ni al historial. Procedimiento en `docs/secretos.md`.

### Notas de dominio pendientes de validación del Dr. Luquetta

- Los **umbrales de alerta de laboratorio** (Anexo B) siguen siendo ilustrativos.
- El **umbral de vigencia** de un examen (hoy 3 meses) es un valor por defecto.
