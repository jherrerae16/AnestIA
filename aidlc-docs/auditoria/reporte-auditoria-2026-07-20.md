# Reporte de auditoría — AnestIA

**Fecha:** 2026-07-20
**Alcance:** backend, frontend, workers, adaptadores, seed. Incluye los cambios sin commitear de la sesión previa (refuerzo CS2 de peso/talla/IMC y fix de timezone del calendario).
**Método:** auditoría de solo lectura con tres lentes (fabricación clínica CS1–CS8 · hardcoding · bugs y deuda). Hallazgos verificados a mano donde se afirma "confirmado". Lo no probado se marca "requiere verificación".
**Estado:** NADA corregido. Este reporte espera aprobación del usuario para priorizar y corregir.

**Salud de build/test (esta corrida):** `apps/api` tsc 0 errores · `packages/shared` tsc 0 errores · `apps/web` ng build limpio · vitest api 53/53 · vitest shared 93/93 · sin tests skip/only · sin `@ts-ignore` en código fuente.

> Nota de provenance: la regla que CLAUDE.md:38 cita, `.claude/rules/clinical-safety.md`, **no existe** (`.claude/rules/` no existe). La leyenda CS1–CS8 vive en `aidlc-docs/inception/user-stories/stories.md:5` y en CLAUDE.md "Reglas de oro" (22–38). Es un gap de documentación (ver B/observación), no un hallazgo clínico.

---

## Sección A — Fabricación de datos clínicos (CS1–CS8)

Leyenda CS usada: **CS1** HITL · **CS2** no-fabricación + `fuente` · **CS3** examen/signos = `pendiente_examen` y bloquea aprobación · **CS4** derivar-no-inventar · **CS5** salida estructurada Zod (rechaza campos prohibidos) · **CS6** Zod en ambos bordes · **CS7** inmutabilidad + audit · **CS8** lógica GLP-1.

### CRÍTICO

#### A-C1 — El stub inyecta 7 valores de laboratorio ficticios en el documento de un paciente real
- **Dónde:** `apps/api/lib/ai/index.ts:71-87` (`StubAIProvider.extractLabs`).
- **Qué pasa:** con `AI_PROVIDER=stub`, si el caso tiene **≥1 adjunto**, el stub devuelve 7 labs hardcodeados del caso de referencia (Anexo C / Uribe): Hemoglobina 15.9, Hematocrito 48.2, Plaquetas 244000, Leucocitos 7200, TP 10.4, INR 0.97, TPT 29.5 — **sin leer el archivo** (comentario línea 75: "El stub no lee archivos"). Llevan `sourceRef: 'stub:hemograma:hb'` etc.
- **Camino hasta el documento (verificado):** `extractForCase` (`lab.service.ts`) los persiste en `ExtractedLabResult` — el `sourceRef` es no-vacío, así que el guard de trazabilidad CS2 **no** los descarta → `flagForCase` los marca → `buildParaclinicos` (`clinical.service.ts:68-84`) los mete en `paraclinicos` del `GeneratedAssessment` → el PDF los imprime (`pdf-template.ts`).
- **Regla:** **CS2** (fabricación de resultados de laboratorio en documento médico-legal). El `sourceRef` existe pero es **fuente falsa** (`stub:*`), lo que anula justo la trazabilidad que CS2 busca; nada aguas abajo rechaza un `sourceRef` que empieza en `stub:`.
- **Severidad y matiz honesto:** crítico **por diseño**. **No está activo hoy**: el piloto corre con `AI_PROVIDER=anthropic` (verificado: `.env` AI_PROVIDER="anthropic", key presente, y `modelUsed=claude-opus-4-8` en el último assessment). El stub **no** corre bajo `anthropic`. El riesgo se materializa si alguien cambia a `stub` con adjuntos (demos, tests manuales, o el fallback silencioso de A-A1).
- **Propuesta:** (a) que el stub devuelva `labs: []` también con adjuntos (como ya hace con cero adjuntos, línea 73), moviendo el caso de referencia a un fixture de test explícito; o (b) que la persistencia rechace cualquier `sourceRef` que empiece en `stub:` salvo modo dev-fixture explícito; o (c) hard-gate para que el stub no pueda correr sobre un caso real. Mínimo: `stub:` nunca debe tratarse como dato extraído real.

### ADVERTENCIA

#### A-A1 — `AI_PROVIDER` cae a `stub` por defecto si la env falta/está mal
- **Dónde:** `apps/api/lib/ai/index.ts:335` — `provider = process.env.AI_PROVIDER ?? 'stub'`.
- **Qué pasa:** una env ausente o mal escrita **silenciosamente** produce documentos con el stub (incluidos los labs falsos de A-C1), narrativa/ASA/recomendaciones incluidas. `activeModelLabel()` sí registra `modelUsed: 'stub'` (trazable), pero **nada bloquea** que un documento generado por stub avance a revisión/aprobación.
- **Regla:** CS2/CS5. Respuesta a la pregunta del alcance ("¿el stub produce salida con anthropic?"): **no** — la selección es pura por env; no hay camino donde el stub corra *mientras* `AI_PROVIDER=anthropic`. El riesgo es el **default silencioso**.
- **Propuesta:** en entorno no-dev, fail-closed si `AI_PROVIDER` no está seteado (en vez de caer a `stub`); y/o exponer `modelUsed === 'stub'` como condición bloqueante en `canApprove`.

#### A-A2 — El sexo declarado por el paciente (P4) se etiqueta `fuente='derivado:IA'`
- **Dónde:** `apps/api/lib/ai/index.ts:153` (y 152-156) — stub.
- **Qué pasa:** cuando no se puede calcular la edad pero hay sexo, `edadSexo = derived(sexo)` estampa `fuente='derivado:IA'` sobre un valor que vino **directo de P4** (respuesta cruda, no derivada). El caso combinado edad+sexo también rotula todo `derivado:IA` aunque la mitad (sexo) sea dato verbatim. La línea 155 sí usa correctamente `formulario:P4` cuando solo hay sexo.
- **Regla:** CS2 (integridad de provenance — no fabrica el valor, pero pone una `fuente` falsa que impide al auditor/lector saber que el sexo fue declarado por el paciente).
- **Propuesta:** usar `formulario:P4` (o compuesto `formulario:P3-4; derivado:IA` para la mitad de edad) en vez de `derivado:IA` a secas. Solo aplica al path stub.

#### A-A3 — `documentSchema` no restringe las claves de campo (CS5 solo parcialmente forzado en el borde compartido)
- **Dónde:** `packages/shared/src/document.ts:31-37` (secciones = `z.record(docFieldSchema)`, record abierto); se aplica en `clinical.service.ts:101`.
- **Qué pasa:** CLAUDE.md regla 5 y el comentario del schema implican que un campo prohibido se rechaza, pero `documentSchema.parse` acepta **cualquier** clave. El schema cerrado/`.strict()` solo existe dentro del provider Anthropic (`anthropic.ts:153-170`) → protege el path anthropic pero **no** el borde compartido. `enforceGuardrails` anula valores no-`ok` y fuerza examen/peso-talla, pero **no** elimina una clave extra inesperada con valor+fuente `ok`.
- **Regla:** CS5. **Requiere verificación de explotabilidad:** con los dos providers actuales (anthropic strict + stub hardcodeado) no es alcanzable hoy; es debilidad de defensa-en-profundidad.
- **Propuesta:** hacer `documentSchema` por-sección `z.object({...}).strict()` (o intersecar con un set de claves permitidas) para que el rechazo de campos prohibidos (CS5) valga en el borde compartido, no solo dentro del provider.

### OBSERVACIÓN (verificados limpios o deuda documentada — sin acción inmediata)

- **A-O1** `applyExamNormal` (`packages/shared/src/approval.ts:73-111`): texto de examen normal enlatado (Mallampati I, etc.) — **compatible con CS3**: solo corre por acción explícita del anestesiólogo (`loadExamNormal`), estampa `fuente:'anestesiologo:examen-normal-confirmado'`, y **excluye** los campos medidos (signos vitales, peso/talla) que quedan `pendiente_examen` y siguen bloqueando `canApprove`. Sugerencia: que el Dr. firme que ese texto boilerplate por defecto es clínicamente aceptable.
- **A-O2** Examen/signos **siempre** `pendiente_examen` en TODO flujo automático — verificado limpio (stub `examen_fisico:{}`, anthropic `examen_fisico:{}` + prompt lo prohíbe, `enforceGuardrails` sobrescribe todos los `EXAM_FIELDS` a `pending()`). CS3 satisfecho.
- **A-O3** "Niega X" solo con "No" explícito (`ai/index.ts:115-121`): blanco nunca produce negación; hábitos exige los tres "No". CS2 satisfecho.
- **A-O4** PDF solo imprime `estado==='ok'`, marca derivados con °, watermark BORRADOR mientras examen pendiente (`pdf-template.ts`). El único valor inyectado es `fecha_valoracion` con `fuente:'sistema:render'` — legítimo. Sin fabricación en el renderer (el riesgo es aguas arriba, A-C1).
- **A-O5** GLP-1 (`glp1.ts:15-22`): detección por substring sobre P15 (dato declarado) — CS8 satisfecho en espíritu. Riesgo bajo de falso positivo por substring; sugerencia: match por límite de palabra. ASA (`clinical.ts:41-50`): deriva solo de comorbilidades declaradas (P13), estampa `derivado:IA` con justificación; nunca dispara sin datos. CS4 OK.

---

## Sección B — Hardcoding

### ALTO

#### B-1 — Rangos de laboratorio hardcodeados en código (pendiente conocido)
- **Dónde:** `packages/shared/src/lab.ts:76-110` (`flagLab`) — umbrales literales: Hb `12/13` según sexo y `>17`; Plaquetas `<100000`/`<150000`; INR `>1.4`; Leucocitos `<4000||>11000`; Creatinina `>1.3`; Glucemia `>250`/`>180`. Relacionado: `lab-groups.ts:101` `LAB_VIGENCIA_MESES = 3`.
- **Limita:** el anestesiólogo no puede ajustar umbrales clínicos sin cambio de código + redeploy. El propio docstring (L72-73) dice "DEFAULT — PENDIENTE de validación clínica del Dr. Luquetta… Configurables aquí"; `docs/lab-rules.md:1` los titula "**configurables**". El diseño pretende rangos editables; la implementación son constantes de código.
- **Dónde debería vivir:** tabla/DB editable (p. ej. modelo `LabRule` por analito + sexo) o al menos tabla respaldada por seed, de modo que los rangos cambien sin tocar `lab.ts`. **Es el único hallazgo de alto impacto genuinamente pendiente en hardcoding.**

### MEDIO

#### B-2 — Cadenas de estado del caso como literales en vez del enum `CaseStatus`
- **Dónde (una vez, lista completa):** `apps/api/lib/services/calendar.service.ts:16`, `distribution.service.ts:100`, `document.service.ts:72`, `dashboard.service.ts:31`, `approval.service.ts:243,303`, `queue/handlers.ts:101`; `apps/web/.../dashboard.page.ts`, `review-approval.page.ts:477`. Mapas de label duplicados en 3 sitios: `reminder.service.ts:114-124`, `core/case-status.ts:3-13`, y el enum.
- **Por qué es problema:** los *valores* del enum son constantes de dominio fijas (no es hallazgo de env/config) — es **consistencia/correctitud**: valores duplicados como literales no tipados en vez de referenciar el enum Prisma `CaseStatus`. Un typo enruta mal un caso, sin error de compilación.
- **Dónde debería vivir:** importar `CaseStatus` del paquete compartido; consolidar los mapas de label en un objeto compartido único.

#### B-3 — Texto de consentimiento como constante de código
- **Dónde:** `packages/shared/src/consent.ts:6-15` (`CONSENT_VERSION`, `CONSENT_TEXT_V1`). El docstring dice "el Dr. Luquetta puede reemplazarlo".
- **Por qué:** si el médico debe poder editar su texto de consentimiento, debería venir del perfil/DB con el valor de código como fallback. Impacto bajo (versionado, default razonable); se reporta por honestidad porque el doc implica editabilidad.

### Verificado limpio (NO son hallazgos)
URLs/emails/SMTP/APP_ORIGIN: todos env-driven con fallback seguro · sin identidad del piloto ("Luquetta"/"Portoazul"/"jherrera") fuera de seed.ts y comentarios · sin secrets/keys/tokens en código (todo vía `process.env`) · el stub **no** puede filtrarse a documentos bajo `anthropic` (selección por env) · asset paths vienen del perfil (`document.service.ts` lee `clinicLogoUrl`; placeholders solo referenciados desde seed) · constantes mágicas **nombradas y comentadas** (`HORAS_48`, `LINK_TTL_DAYS=7`, `SESSION_TTL`, `MAX_FILES=10`, cron `'0 7 * * *' America/Bogota`, `BOGOTA_OFFSET_MIN`, `MAX_TOKENS`) · web app sin host de API hardcodeado (rutas relativas `/api/...`) · duplicación de texto UI despreciable ("Cargando" ×2).

---

## Sección C — Bugs y deuda técnica pendiente

### ALTA

#### C-1 — Reconciliador de casos atascados: AUSENTE (confirmado)
- **Dónde:** gap; comentario en `apps/api/lib/services/form.service.ts:162-166`. `grep -i reconcil` = cero implementación.
- **Falla:** `submitForm` setea `submittedAt` dentro de la transacción y publica `form.submitted` **después** del commit; si el publish falla, solo se loguea, y el guard de idempotencia `if (kase.formResponse?.submittedAt) return {}` bloquea cualquier re-envío del paciente. El caso queda en `RESPUESTAS_RECIBIDAS` sin assessment, para siempre, sin recuperación automática. Hoy se recupera a mano.
- **Prioridad:** alta (adyacente a pérdida de dato: un caso puede nunca generar documento en silencio). Documentado en CLAUDE.md:126-127,146 y PRD:766-777.

### MEDIA

#### C-2 — `populatedSections` descarta preguntas fuera de rango (confirmado, latente)
- **Dónde:** `apps/web/src/app/pages/patient-form.page.ts:416-424` + comentario engañoso en `:39-40`.
- **Qué pasa:** las secciones se arman por rango de `order` (1-6, 7-8+26, 9-11, 12-21, 22-25) y se filtran las vacías. **No hay catch-all "Otros datos"** pese a que el comentario afirma que las preguntas fuera de rango "caen en Otros datos". Cualquier pregunta visible con `order` fuera de todo rango (p. ej. 27+) se omite silenciosamente del formulario — el paciente nunca la ve ni la responde. Con el preset base de 26 los rangos cubren todo, así que no dispara hoy; late hasta que llegue el editor de cuestionarios (C-6).
- **Prioridad:** media (el comentario describe un comportamiento no implementado; bloqueará el editor de presets).

#### C-3 — Coma decimal en peso/talla: IMC se cae en silencio + asimetría (confirmado)
- **Dónde:** `clinical.service.ts:36-39` y `apps/api/lib/ai/index.ts:158-168`.
- **Qué pasa:** dos sitios de lectura discrepan y ninguno normaliza la coma del peso. En ensamblaje, `Number("1,75")`→`NaN`→`isFinite` falla→`pesoKg/tallaCm=null`→**IMC se descarta en silencio** (`computeIMC` corta). En el stub, la talla **sí** se normaliza (`parseFloat(replace(',','.'))`, `:163`) pero el peso se emite verbatim (`${pesoRaw} kg`, `:167`). `pesoTallaImcText` (`clinical.ts:67-74`) asume entradas ya numéricas.
- **Mitigante:** el input web es `type="number"`; en la mayoría de navegadores la coma se rechaza/vacía el campo. **Requiere verificación** de la conducta real por locale en navegadores móviles para estimar la tasa real de impacto.
- **Prioridad:** media (inconsistencia confirmada; frecuencia real por verificar).

#### C-4 — Respuestas indexadas por `order` mutable, sin id estable de pregunta (confirmado, fragilidad latente)
- **Dónde:** `packages/shared/src/form.ts:11-16` (`Record<order-string, answer>`), `Question.order` = `Int` plano (`schema.prisma`), lectura por literal en `ai/index.ts` y `clinical.service.ts:36-37` (`answers['5']/['6']`).
- **Qué pasa:** no hay UUID estable de pregunta. Renumerar preguntas + re-seed (o un preset con orders distintos) reinterpreta silenciosamente las respuestas viejas contra el nuevo significado de cada `order`. No se dispara hoy porque solo existe el preset base de 26; se relaciona con C-6.
- **Nota:** este es exactamente el mecanismo que se sospechó (y se descartó para el caso puntual) en la investigación del "bug 78/193". Sigue siendo una fragilidad de diseño real.
- **Prioridad:** media (fragilidad latente).

#### C-5 — `ANTHROPIC_API_KEY` en claro en `.env` (confirmado, radio limitado)
- **Dónde:** `.env:10`. **No** trackeado por git (`.gitignore` lo excluye; no está en el historial). También `.secrets/google-sheets-sa.json` en disco.
- **Prioridad:** media (exposición solo disco local). Rotación pendiente documentada (P4.4).

#### C-6 — Editor de cuestionarios propios: no existe (feature gap)
- Solo el preset base. Interactúa con C-2 y C-4 (ambos laten hasta que esto llegue). Prioridad media.

#### C-7 — Umbrales de alerta de laboratorio sin validar clínicamente
- Mismo origen que B-1. PRD:775 los marca ilustrativos, pendientes de validación del Dr. Luquetta. Adyacente a seguridad clínica (umbrales errados → banderas rojas erradas). Prioridad media.

### BAJA

- **C-8** Casts `as never`/`as any` de Prisma (JSON/enum) — amplios pero mitigados por Zod en los bordes; sin riesgo de compilación real. `apps/api/.next/.../validator.ts` con `@ts-ignore` es código generado (git-ignored), ignorar.
- **C-9** Gap de doc: `.claude/rules/clinical-safety.md` referenciado por CLAUDE.md:38 no existe; la leyenda CS vive en stories.md y CLAUDE.md. Crear el archivo o corregir la referencia.
- **C-10** Decisión Google Sheets (P4.3), ventana de vigencia de examen (P4.6, 3 meses default sin validar), preset pediátrico diferido, branding sembrado como placeholder con registro "PENDIENTE" — todos scope-piloto documentados.

---

## Sección D — Resumen ejecutivo

### Conteo por severidad
| Bloque | Crítico/Alto | Advertencia/Medio | Observación/Bajo |
|---|---|---|---|
| A · Fabricación clínica | 1 (A-C1) | 3 (A-A1, A-A2, A-A3) | 5 (A-O1…O5) |
| B · Hardcoding | 1 (B-1) | 2 (B-2, B-3) | — |
| C · Bugs/deuda | 1 (C-1) | 6 (C-2…C-7) | 3 (C-8…C-10) |

### Titular honesto
El path del motor clínico **real** (anthropic) está sólido: examen siempre pendiente, negaciones correctas, provenance, bloqueo de aprobación, inmutabilidad, PDF solo imprime `ok`. La única fabricación **probada** que alcanza un documento es **A-C1** (labs falsos del stub con adjunto) — y **no está activa hoy** porque el piloto corre con `anthropic`; el stub no corre bajo `anthropic`. El vector de riesgo real es el **default silencioso a stub** (A-A1).

### Recomendación priorizada (qué arreglar primero)
1. **A-A1 + A-C1 juntos (rápido, cierra el riesgo crítico):** fail-closed si `AI_PROVIDER` no está seteado + que el stub no emita labs con adjuntos (moverlos a fixture). Elimina de raíz el único camino de fabricación probado. Bajo esfuerzo, alto valor.
2. **C-1 reconciliador (alta, pérdida de dato):** job que re-emita `form.submitted` para casos con `submittedAt` y sin assessment. Es el gap operativo más peligroso.
3. **A-A2 (rápido, corrección de provenance):** `formulario:P4` en vez de `derivado:IA` para el sexo. Trivial.
4. **B-1 / C-7 (rangos de lab configurables + validación clínica):** mover umbrales a tabla editable y conseguir sign-off del Dr. Es pendiente conocido y adyacente a seguridad clínica.
5. **C-2 y C-3 (bugs latentes/reales del formulario):** catch-all "Otros datos" (o quitar el comentario engañoso) y normalizar coma decimal en peso/talla. C-3 tiene impacto real hoy (IMC se cae).
6. **A-A3 + B-2 (endurecimiento):** `documentSchema` `.strict()` en el borde compartido; enum `CaseStatus` en vez de literales. Defensa en profundidad / consistencia.
7. **Deuda de menor urgencia:** C-4 (id estable de pregunta — antes del editor de presets C-6), C-5 (rotar key), B-3/C-9/C-10.

**Fixes ya hechos en la sesión previa (contexto, no pendientes):** refuerzo CS2 peso/talla/IMC forzado por código (cierra la fabricación de esos campos aunque el modelo alucine) y fix de timezone del calendario (fecha pura, sin corrimiento). Ambos con tests, sin commitear aún.
