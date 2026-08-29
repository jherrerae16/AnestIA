import type { DocumentJSON, DocField } from './document';
import { EXAM_FIELDS } from './clinical';
import { toMedicalTerms, autoCorrectTerm } from './medical-terms';
import { CODES, CODIGOS_ACORDEON, QUESTION_DICTIONARY } from './dictionary';

/**
 * Auditor independiente del documento clínico (patrón generador + crítico).
 * Corre DESPUÉS del motor clínico y ANTES del render. No corrige contenido clínico:
 * sólo levanta hallazgos para que los resuelva el anestesiólogo (CS1).
 *
 * Esta capa es 100% determinística (reglas). La parte de juicio en lenguaje natural
 * (contradicciones sutiles, coherencia clínica) la añade el proveedor de IA cuando exista.
 */

/** Severidad del hallazgo. Sólo `bloqueante` impide continuar (seguridad dura). */
export type FindingLevel = 'bloqueante' | 'advertencia' | 'informativo';

export interface AuditFinding {
  level: FindingLevel;
  /** Categoría corta, para agrupar/filtrar. */
  category:
    | 'fila_huerfana'
    | 'coherencia'
    | 'contradiccion'
    | 'completitud'
    | 'seguridad'
    | 'formato'
    | 'redaccion'
    | 'terminologia';
  /** Mensaje en lenguaje claro para el anestesiólogo. */
  message: string;
  /** Ruta del campo implicado (sección.clave), si aplica. */
  field?: string;
}

export interface AuditReport {
  findings: AuditFinding[];
  /** true si hay al menos un hallazgo bloqueante (violación de seguridad dura). */
  blocked: boolean;
  /** Versión de las reglas, para trazabilidad. */
  rulesVersion: string;
}

export const AUDITOR_RULES_VERSION = 'auditor-v3';

/**
 * Frases prohibidas por el Prompt Maestro (lenguaje de IA / hedging). El documento debe
 * transmitir criterio clínico, no incertidumbre de modelo. Se comparan sobre el texto
 * normalizado (minúsculas, sin acentos) de los campos narrativos. `prompt-maestro-v2.md`.
 */
const FRASES_PROHIBIDAS: { patron: RegExp; etiqueta: string }[] = [
  { patron: /segun la informacion (proporcionada|suministrada|disponible|brindada)/, etiqueta: 'según la información proporcionada' },
  { patron: /\bse sugiere\b/, etiqueta: 'se sugiere' },
  { patron: /\bparece que\b|\bpareciera\b|\baparenta\b/, etiqueta: 'parece' },
  { patron: /\bpodria\b|\bpodrian\b|\bposiblemente\b|\bquizas\b|\btal vez\b/, etiqueta: 'podría / posiblemente' },
  { patron: /como modelo de lenguaje|como (una |un )?ia\b|inteligencia artificial|no puedo (garantizar|asegurar|confirmar)/, etiqueta: 'referencia a IA / disculpa de modelo' },
  { patron: /\ben base a los datos\b|\bde acuerdo a lo (indicado|reportado|informado)\b/, etiqueta: 'muletilla de fuente' },
];

/**
 * El concepto anestésico es la CONCLUSIÓN del anestesiólogo tras evaluar. El borrador NO debe
 * hablar del acto de evaluar ni de sus tiempos ("la aptitud se definirá tras el examen"): eso es
 * meta-texto sobre el proceso, no criterio clínico, y suena a IA describiendo su propia
 * limitación. Se detecta sólo en concepto/plan (donde no tiene lugar), no en recomendaciones.
 */
const APTITUD_PROCESO: RegExp[] = [
  /(aptitud|apto|elegibilidad|concepto (final|definitivo)).{0,40}(se (definir|establecer|determinar|emitir|dar)|tras el examen|posterior al examen|luego de la evaluacion|evaluacion presencial|examen presencial)/,
  /(se (definir|establecer|determinar|emitir)a?).{0,30}(tras|despues de|posterior a|luego de).{0,30}(examen|evaluacion|valoracion presencial)/,
  /pendiente de (evaluacion|valoracion|examen) presencial/,
];

/**
 * Disclaimers genéricos de cobertura al cerrar plan/concepto/recomendaciones. El documento lo firma
 * un anestesiólogo que YA evaluó; el receptor recibe el resultado final, no un borrador provisional.
 * Estas frases hacen que el documento parezca preliminar y no aportan (la seguridad está resuelta a
 * nivel de datos: el examen queda `pendiente_examen` y bloquea la aprobación). Se detectan sólo como
 * CIERRE de cobertura genérico, no una acción concreta atada a un hallazgo ("precisar parámetros del
 * CPAP" es específico y NO cae aquí).
 */
const DISCLAIMER_GENERICO: { patron: RegExp; etiqueta: string }[] = [
  { patron: /sujet[ao]s? a (la )?(valoracion|evaluacion|revision) presencial/, etiqueta: 'sujeto a valoración presencial' },
  { patron: /(plan|concepto|manejo) (definitivo|final) sujet/, etiqueta: 'plan definitivo sujeto a…' },
  { patron: /confirmar (los )?hallazgos.{0,40}(evaluacion|valoracion|examen) presencial/, etiqueta: 'confirmar hallazgos en la evaluación presencial' },
  { patron: /en la evaluacion presencial\.?\s*$/, etiqueta: 'cierre "…en la evaluación presencial"' },
  { patron: /segun (el )?protocolo institucional/, etiqueta: 'según protocolo institucional' },
  { patron: /monitorizacion estandar/, etiqueta: 'monitorización estándar (sin especificar cuál)' },
  { patron: /continuar (con )?(los )?estudios\b(?!.{0,30}\bde\b)/, etiqueta: 'continuar estudios (sin decir cuál)' },
];

/**
 * Medicamentos con implicación anestésica directa (perioperatorio) que, si el paciente los
 * declara (P15), deben quedar reflejados en el concepto o las recomendaciones — no basta con
 * listarlos en antecedentes. Cada entrada agrupa sinónimos comerciales/genéricos comunes.
 */
const MEDICAMENTOS_RELEVANTES: { match: string[]; etiqueta: string }[] = [
  { match: ['warfarina', 'coumadin', 'acenocumarol', 'sintrom'], etiqueta: 'anticoagulante cumarínico' },
  { match: ['rivaroxaban', 'xarelto', 'apixaban', 'eliquis', 'dabigatran', 'pradaxa', 'edoxaban'], etiqueta: 'anticoagulante oral directo' },
  { match: ['heparina', 'enoxaparina', 'clexane', 'fraxiparina'], etiqueta: 'heparina' },
  { match: ['clopidogrel', 'plavix', 'prasugrel', 'ticagrelor', 'brilinta'], etiqueta: 'antiagregante plaquetario' },
  { match: ['aspirina', 'asa', 'acido acetilsalicilico', 'aspirineta'], etiqueta: 'ácido acetilsalicílico' },
  { match: ['metformina', 'glibenclamida', 'insulina', 'glargina', 'lantus'], etiqueta: 'antidiabético / insulina' },
  { match: ['prednisona', 'prednisolona', 'dexametasona', 'corticoide', 'hidrocortisona'], etiqueta: 'corticoide sistémico' },
  { match: ['losartan', 'enalapril', 'valsartan', 'lisinopril', 'captopril', 'ieca', 'ara ii'], etiqueta: 'IECA / ARA-II' },
  { match: ['sertralina', 'fluoxetina', 'escitalopram', 'venlafaxina', 'imao', 'tranilcipromina'], etiqueta: 'antidepresivo (interacción anestésica)' },
];

/** Respuestas del formulario indexadas por CÓDIGO de la especificación. */
export type AuditAnswers = Record<string, { value: unknown; type?: string }>;

export interface AuditInput {
  doc: DocumentJSON;
  answers: AuditAnswers;
  /** Labs con flag ya aplicado (para verificar que las alertas se reflejen). */
  labs?: { analyte: string; flag: string }[];
}

// ── helpers ──
const norm = (v: unknown): string =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const isYes = (a: AuditAnswers, code: string): boolean => norm(a[code]?.value) === 'si';
// Ojo: `no_sabe` NO es `no`. Una negación explícita es lo único que autoriza a escribir
// "Niega X" y lo único que puede contradecir un detalle (CS2).
const isNo = (a: AuditAnswers, code: string): boolean => norm(a[code]?.value) === 'no';
const answered = (a: AuditAnswers, code: string): boolean => {
  const v = a[code]?.value;
  if (Array.isArray(v)) return v.length > 0;
  return String(v ?? '').trim() !== '';
};
const listOf = (a: AuditAnswers, code: string): string => {
  const v = a[code]?.value;
  return Array.isArray(v) ? v.join(', ') : String(v ?? '');
};

/**
 * Medicamentos declarados, en texto. `RX02` es un repetidor: sus filas van serializadas, y
 * compararlas en crudo hacía que el auditor buscara el nombre del fármaco dentro de las llaves.
 */
const medicamentosDeclarados = (a: AuditAnswers): string => {
  const v = a[CODES.listaMedicamentos]?.value;
  if (!Array.isArray(v)) return String(v ?? '');
  return v.map((raw) => {
    try {
      const o: unknown = JSON.parse(String(raw));
      if (o && typeof o === 'object') return Object.values(o as Record<string, unknown>).join(' ');
    } catch { /* fila en texto suelto */ }
    return String(raw);
  }).join(' · ');
};

/** ¿Declara consumo actual o pasado de tabaco/vapeo? "Nunca" no cuenta (HB01). */
const fuma = (a: AuditAnswers): boolean => {
  const v = norm(a[CODES.tabaco]?.value);
  return v !== '' && v !== 'nunca';
};

/** Texto plano de un campo, o '' si no está en estado ok. */
function text(f: DocField | undefined): string {
  return f && f.estado === 'ok' && f.valor != null ? String(f.valor) : '';
}

/** Secciones de contenido clínico (el examen se audita aparte). */
const CONTENT_SECTIONS = ['identificacion', 'antecedentes', 'paraclinicos', 'valoracion_plan'] as const;

/**
 * Audita el documento generado contra las respuestas del paciente y las reglas clínicas.
 * Puro y determinístico → testeable y sin coste de IA.
 */
export function auditDocument(input: AuditInput): AuditReport {
  const { doc, answers: a, labs = [] } = input;
  const findings: AuditFinding[] = [];
  const add = (level: FindingLevel, category: AuditFinding['category'], message: string, field?: string) =>
    findings.push({ level, category, message, field });

  // ── 1. Seguridad dura (BLOQUEANTE) ──────────────────────────────
  // 1a. Campo poblado sin fuente.
  for (const section of CONTENT_SECTIONS) {
    const sec = (doc[section] ?? {}) as Record<string, DocField>;
    for (const [key, f] of Object.entries(sec)) {
      if (f?.estado === 'ok' && f.valor != null && String(f.valor).trim() !== '' && !f.fuente) {
        add('bloqueante', 'seguridad', `El campo "${key}" tiene contenido pero no declara su fuente.`, `${section}.${key}`);
      }
    }
  }
  // 1b. Valor inventado en el examen físico (debe estar pendiente o puesto por el médico).
  const exam = (doc.examen_fisico ?? {}) as Record<string, DocField>;
  for (const [key, f] of Object.entries(exam)) {
    if (f?.estado === 'ok' && f.valor != null && String(f.valor).trim() !== '') {
      const fuente = String(f.fuente ?? '');
      if (!fuente.startsWith('anestesiologo')) {
        add('bloqueante', 'seguridad',
          `El examen físico ("${key}") tiene un valor que no proviene del anestesiólogo. El examen sólo lo registra el médico.`,
          `examen_fisico.${key}`);
      }
    }
  }

  // ── 2. Filas huérfanas / placeholders (ADVERTENCIA) ─────────────
  const PLACEHOLDER = /^(n\/?a|na|pendiente|—|-|\.|sin datos|todo|tbd|lorem)$/i;
  for (const section of CONTENT_SECTIONS) {
    const sec = (doc[section] ?? {}) as Record<string, DocField>;
    for (const [key, f] of Object.entries(sec)) {
      if (f?.estado === 'ok' && (f.valor == null || String(f.valor).trim() === '')) {
        add('advertencia', 'fila_huerfana', `La fila "${key}" está marcada como completa pero no tiene contenido.`, `${section}.${key}`);
      } else if (f?.estado === 'ok' && PLACEHOLDER.test(String(f.valor).trim())) {
        add('advertencia', 'fila_huerfana', `La fila "${key}" contiene un relleno sin valor clínico ("${String(f.valor).trim()}").`, `${section}.${key}`);
      }
    }
  }

  // ── 3. Contradicciones respuesta ↔ respuesta (ADVERTENCIA) ──────
  // Se DERIVAN del diccionario en vez de escribirse a mano. Antes había siete pares cableados
  // (P12/P13, P14/P15, …) que había que recordar ampliar cada vez que se añadía una pregunta
  // condicional. Ahora, toda pregunta cuya regla sea "el padre respondió Sí" genera su propia
  // comprobación: si el padre dijo No y el hijo tiene contenido, hay contradicción.
  for (const { padre, hijo, hijoLabel } of paresCondicionales()) {
    if (isNo(a, padre) && answered(a, hijo)) {
      add('advertencia', 'contradiccion',
        `El paciente respondió "No" en ${padre} pero ${hijo} ("${hijoLabel}") tiene contenido: ` +
        `${listOf(a, hijo)}.`);
    }
  }

  // ── 4. Coherencia respuesta ↔ documento (ADVERTENCIA) ───────────
  const ant = (doc.antecedentes ?? {}) as Record<string, DocField>;
  // Cada "sí" debe abrir su fila con contenido.
  const expandRules: { order: string; key: string; label: string }[] = [
    { order: '12', key: 'patologicos', label: 'antecedentes patológicos' },
    { order: '14', key: 'medicamentos', label: 'medicamentos' },
    { order: '16', key: 'alergias', label: 'alergias' },
    { order: '18', key: 'quirurgicos', label: 'antecedentes quirúrgicos' },
    { order: '20', key: 'transfusionales', label: 'transfusiones' },
    { order: '21', key: 'protesis_dental', label: 'prótesis dental' },
  ];
  for (const r of expandRules) {
    if (isYes(a, r.order) && !text(ant[r.key])) {
      add('advertencia', 'coherencia',
        `El paciente respondió "sí" en ${r.label} (P${r.order}) pero el documento no lo refleja.`,
        `antecedentes.${r.key}`);
    }
  }
  // Documentar el negativo: un "no" debe quedar escrito como "niega…", no desaparecer.
  for (const r of expandRules) {
    if (isNo(a, r.order) && !text(ant[r.key])) {
      add('informativo', 'coherencia',
        `El paciente negó ${r.label} (P${r.order}); conviene dejarlo documentado explícitamente.`,
        `antecedentes.${r.key}`);
    }
  }

  // ── 5. Completitud condicional (ADVERTENCIA) ────────────────────
  // GLP-1 declarado → deben aparecer las recomendaciones de ayuno/aspiración.
  const glp1Text = text(ant['glp1']);
  if (glp1Text) {
    const recomend = norm(text((doc.valoracion_plan ?? {})['recomendaciones']));
    const concepto = norm(text((doc.valoracion_plan ?? {})['concepto']));
    const cubreAyuno = /ayuno|gastric|aspiracion|estomago lleno|ecografia/.test(recomend + ' ' + concepto);
    if (!cubreAyuno) {
      add('advertencia', 'completitud',
        'Se declaró uso de agonista GLP-1 pero las recomendaciones no mencionan el manejo del riesgo de contenido gástrico residual (ayuno/ecografía gástrica).',
        'valoracion_plan.recomendaciones');
    }
  }
  // Prótesis dental → debe considerarse en la vía aérea (concepto o recomendaciones).
  if (isYes(a, CODES.protesisDental)) {
    const vp = (doc.valoracion_plan ?? {}) as Record<string, DocField>;
    const blob = norm(text(vp['concepto']) + ' ' + text(vp['recomendaciones']) + ' ' + text(ant['protesis_dental']));
    if (!/via aerea|protesis|dental|sonrisa/.test(blob)) {
      add('informativo', 'completitud',
        'El paciente refiere prótesis dental o diseño de sonrisa; conviene reflejarlo en la evaluación de vía aérea.',
        'valoracion_plan.concepto');
    }
  }
  // Alerta crítica de laboratorio → debe reflejarse en el concepto, no quedar sólo en la tabla.
  const criticos = labs.filter((l) => l.flag && l.flag.toUpperCase() !== 'NORMAL');
  if (criticos.length > 0) {
    const concepto = norm(text((doc.valoracion_plan ?? {})['concepto']));
    const mencionado = criticos.some((l) => concepto.includes(norm(l.analyte))) ||
      /alterad|hallazgo|paraclinic|fuera de rango/.test(concepto);
    if (!mencionado) {
      add('advertencia', 'completitud',
        `Hay laboratorios fuera de rango (${criticos.map((l) => l.analyte).join(', ')}) que no se mencionan en el concepto anestésico.`,
        'valoracion_plan.concepto');
    }
  }

  // ── 6. Examen físico pendiente (INFORMATIVO) ────────────────────
  const pendientes = EXAM_FIELDS.filter((k) => (exam as Record<string, DocField>)[k]?.estado === 'pendiente_examen');
  if (pendientes.length > 0) {
    add('informativo', 'completitud',
      `El examen físico está pendiente (${pendientes.length} campos). Debe registrarse antes de aprobar.`,
      'examen_fisico');
  }

  // ── 7. Formato: riesgo de desbordar una página (INFORMATIVO) ────
  // La página única es la meta; cuando el contenido clínico no cabe, no pasa nada — por eso
  // se exige redacción concisa (Prompt Maestro). Este aviso empuja a acortar, no bloquea.
  const totalChars = JSON.stringify(doc).length;
  if (totalChars > 9000) {
    add('informativo', 'formato',
      'El documento es extenso y podría no caber en una sola página; priorizar redacción concisa antes de aprobar.');
  }

  // Campos narrativos donde vive la prosa que audita redacción/terminología/ortografía.
  // Labels como SUJETO capitalizado (sin artículo), para no romper la concordancia de género en
  // los mensajes ("El recomendaciones" era incorrecto). Se usan como "El {label}" → "{Label}".
  const NARRATIVA: { seccion: keyof DocumentJSON; clave: string; label: string }[] = [
    { seccion: 'valoracion_plan', clave: 'concepto', label: 'Concepto anestésico' },
    { seccion: 'valoracion_plan', clave: 'plan', label: 'Plan anestésico' },
    { seccion: 'valoracion_plan', clave: 'recomendaciones', label: 'Recomendaciones' },
    { seccion: 'identificacion', clave: 'diagnostico_preoperatorio', label: 'Diagnóstico preoperatorio' },
    { seccion: 'identificacion', clave: 'procedimiento', label: 'Procedimiento' },
  ];
  const narrativaText = (): { label: string; field: string; raw: string }[] =>
    NARRATIVA
      .map(({ seccion, clave, label }) => ({
        label,
        field: `${seccion}.${clave}`,
        raw: text((doc[seccion] as Record<string, DocField> | undefined)?.[clave]),
      }))
      .filter((x) => x.raw.trim() !== '');

  // ── 8. Redacción: lenguaje de IA / hedging prohibido (ADVERTENCIA) ──
  for (const { label, field, raw } of narrativaText()) {
    const n = norm(raw);
    for (const { patron, etiqueta } of FRASES_PROHIBIDAS) {
      if (patron.test(n)) {
        add('advertencia', 'redaccion',
          `${label} usa lenguaje de IA/incertidumbre prohibido por el Prompt Maestro ("${etiqueta}"). El texto debe transmitir criterio clínico.`,
          field);
      }
    }
    // El concepto/plan no debe hablar de aptitud ni del acto de evaluar (meta-proceso).
    if (field === 'valoracion_plan.concepto' || field === 'valoracion_plan.plan') {
      if (APTITUD_PROCESO.some((re) => re.test(n))) {
        add('advertencia', 'redaccion',
          `${label} menciona la aptitud o el acto de evaluar ("la aptitud se definirá tras el examen…"). El concepto sintetiza el cuadro y el riesgo; la conclusión de aptitud la emite el anestesiólogo, no se anticipa como proceso en el borrador.`,
          field);
      }
    }
    // Plan/concepto/recomendaciones no cierran con disclaimers genéricos de cobertura.
    if (field === 'valoracion_plan.concepto' || field === 'valoracion_plan.plan' || field === 'valoracion_plan.recomendaciones') {
      for (const { patron, etiqueta } of DISCLAIMER_GENERICO) {
        if (patron.test(n)) {
          add('advertencia', 'redaccion',
            `${label} cierra con un disclaimer genérico de cobertura ("${etiqueta}"). El documento lo firma un anestesiólogo que ya evaluó; el cierre debe ser la conclusión clínica concreta, no un recordatorio de proceso.`,
            field);
        }
      }
    }
  }

  // ── 9. Terminología: coloquialismo sin traducir en la prosa (ADVERTENCIA) ──
  // El pipeline ya AUTO-CORRIGE los coloquialismos seguros y sin pérdida (autoCorrectTerm) antes
  // de que el médico vea el borrador. Aquí sólo queda advertir de lo que NO se puede corregir solo
  // sin dañar el texto: coloquialismos con calificadores ("candidato a cirugía bariátrica") donde
  // traducir borraría contexto. Se advierte SIN proponer un reemplazo (cualquier sugerencia
  // automática sería lossy); la redacción final la decide el médico.
  for (const { label, field, raw } of narrativaText()) {
    if (field !== 'identificacion.procedimiento' && field !== 'identificacion.diagnostico_preoperatorio') continue;
    // Si autoCorrectTerm devuelve algo, el pipeline ya lo corrigió → no hay coloquialismo crudo.
    if (autoCorrectTerm(raw)) continue;
    // ¿Hay un término de diccionario escondido con contexto alrededor? Entonces quedó crudo.
    const { text: traducido } = toMedicalTerms(raw);
    if (norm(traducido) !== norm(raw) && !norm(raw).includes(norm(traducido))) {
      add('advertencia', 'terminologia',
        `${label} mezcla lenguaje coloquial con calificadores ("${raw}"); conviene reescribirlo en término médico conservando el contexto clínico.`,
        field);
    }
  }

  // ── 11. ASA: coherencia con comorbilidades declaradas (ADVERTENCIA) ──
  // No re-calcula el ASA (eso es juicio del anestesiólogo/motor); sólo levanta la mano cuando
  // el nivel escrito choca de forma evidente con lo que el paciente declaró.
  const asaRaw = text((doc.identificacion as Record<string, DocField> | undefined)?.['asa']);
  const asaNum = (asaRaw.match(/\b([1-5])\b|\b(I{1,3}|IV|V)\b/) ? asaRaw : '').toUpperCase();
  const asaEsUno = /\bASA\s*(1|I)\b/.test(asaNum) || /^\s*(1|I)\s*$/.test(asaNum);
  if (asaRaw) {
    const declaraComorbilidad =
      isYes(a, CODES.tieneEnfermedad) ||
      CODIGOS_ACORDEON.some((c) => answered(a, c)) ||
      isYes(a, CODES.tomaMedicamentos) ||
      // El tabaco dejó de ser un sí/no: la spec separa nunca / exfumador / cigarrillo / vapeo.
      // "Nunca" es una respuesta, no un antecedente — `answered` lo contaría como comorbilidad.
      fuma(a);
    if (asaEsUno && declaraComorbilidad) {
      add('advertencia', 'coherencia',
        `El ASA registrado es I (paciente sano) pero el paciente declaró comorbilidades, medicación o tabaquismo. Revisar la clasificación ASA.`,
        'identificacion.asa');
    }

    // Redundancia ASA ↔ condición actual: si la MISMA cifra (valor + unidad, p. ej. "10.3 g/dL")
    // aparece en ambos campos, se está duplicando. El ASA lleva los hallazgos clave; la condición
    // actual resume sin repetir las cifras.
    const condRaw = text((doc.identificacion as Record<string, DocField> | undefined)?.['condicion_actual']);
    if (condRaw) {
      // Cifra clínica = número + unidad de laboratorio. La unidad es genérica (cubre g/dl, u/l,
      // mui/l, pg/ml, %… sin lista cerrada), pero se EXCLUYEN unidades no clínicas (años/meses/días)
      // para no marcar la edad como cifra repetida. Se normaliza la puntuación final.
      const NO_CLINICA = /^\d+(?:[.,]\d+)?\s*(anos?|meses|mes|dias?|semanas?)$/;
      const cifras = (s: string) =>
        new Set((norm(s).match(/\d+(?:[.,]\d+)?\s*(?:%|[a-zµ³/·]+)/g) ?? [])
          .map((m) => m.replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim())
          .filter((m) => /[a-z%µ]/.test(m) && !NO_CLINICA.test(m)));
      const enAsa = cifras(asaRaw);
      const compartidas = [...cifras(condRaw)].filter((c) => enAsa.has(c));
      if (compartidas.length > 0) {
        add('advertencia', 'redaccion',
          `El ASA y la condición actual repiten la(s) misma(s) cifra(s) (${compartidas.join(', ')}). El ASA lleva los hallazgos clave; la condición actual debe resumir sin duplicar las cifras.`,
          'identificacion.condicion_actual');
      }
    }
  }

  // ── 12. Interpretar medicamentos de riesgo anestésico (ADVERTENCIA) ──
  // Si P15 declara un fármaco con manejo perioperatorio, debe reflejarse en concepto/recomendaciones.
  if (answered(a, CODES.listaMedicamentos)) {
    const declarados = norm(medicamentosDeclarados(a));
    const vp = (doc.valoracion_plan ?? {}) as Record<string, DocField>;
    const proseVP = norm(text(vp['concepto']) + ' ' + text(vp['recomendaciones']) + ' ' + text(ant['medicamentos']));
    for (const med of MEDICAMENTOS_RELEVANTES) {
      const presente = med.match.some((m) => new RegExp(`(?<![a-z0-9])${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(declarados));
      if (!presente) continue;
      // ¿Se menciona esa clase de fármaco (o su manejo) en la valoración?
      const reflejado = med.match.some((m) => proseVP.includes(m)) ||
        norm(med.etiqueta).split(/[ /]/).some((w) => w.length > 4 && proseVP.includes(w));
      if (!reflejado) {
        add('advertencia', 'completitud',
          `El paciente declaró un ${med.etiqueta} (P15) con implicación perioperatoria que no se refleja en el concepto ni en las recomendaciones.`,
          'valoracion_plan.recomendaciones');
      }
    }
  }

  return {
    findings,
    blocked: findings.some((f) => f.level === 'bloqueante'),
    rulesVersion: AUDITOR_RULES_VERSION,
  };
}

/**
 * Pares padre→hijo derivados del diccionario: toda pregunta cuya activación sea exactamente
 * "el padre respondió Sí". Es la forma declarativa de las contradicciones que antes se
 * mantenían a mano, y crece sola cuando la especificación añade una rama condicional.
 */
function paresCondicionales(): { padre: string; hijo: string; hijoLabel: string }[] {
  const out: { padre: string; hijo: string; hijoLabel: string }[] = [];
  for (const q of QUESTION_DICTIONARY) {
    const r = q.activacion;
    if (r?.kind === 'answer' && r.op === 'equals' && String(r.value).toLowerCase() === 'si') {
      out.push({ padre: r.code, hijo: q.code, hijoLabel: q.label });
    }
  }
  return out;
}
