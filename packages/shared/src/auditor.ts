import type { DocumentJSON, DocField } from './document';
import { EXAM_FIELDS } from './clinical';

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
    | 'formato';
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

export const AUDITOR_RULES_VERSION = 'auditor-v1';

/** Respuestas del formulario indexadas por order (string). */
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

const isYes = (a: AuditAnswers, order: string): boolean => norm(a[order]?.value) === 'si';
const isNo = (a: AuditAnswers, order: string): boolean => norm(a[order]?.value) === 'no';
const answered = (a: AuditAnswers, order: string): boolean => {
  const v = a[order]?.value;
  if (Array.isArray(v)) return v.length > 0;
  return String(v ?? '').trim() !== '';
};
const listOf = (a: AuditAnswers, order: string): string => {
  const v = a[order]?.value;
  return Array.isArray(v) ? v.join(', ') : String(v ?? '');
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
  // Niega enfermedad pero marcó patologías.
  if (isNo(a, '12') && answered(a, '13')) {
    add('advertencia', 'contradiccion',
      `El paciente negó sufrir enfermedades (P12) pero marcó patologías en el checklist (P13): ${listOf(a, '13')}.`);
  }
  // Niega medicamentos pero declaró cuáles.
  if (isNo(a, '14') && answered(a, '15')) {
    add('advertencia', 'contradiccion',
      `El paciente negó tomar medicamentos (P14) pero especificó: "${listOf(a, '15')}" (P15).`);
  }
  // Niega alergias pero especificó a qué.
  if (isNo(a, '16') && answered(a, '17')) {
    add('advertencia', 'contradiccion',
      `El paciente negó alergias (P16) pero especificó: "${listOf(a, '17')}" (P17).`);
  }
  // Niega cirugías previas pero las detalló.
  if (isNo(a, '18') && answered(a, '19')) {
    add('advertencia', 'contradiccion',
      `El paciente negó cirugías previas (P18) pero detalló: "${listOf(a, '19')}" (P19).`);
  }
  // Niega fumar pero reportó cigarrillos/día.
  if (isNo(a, '22') && answered(a, '23')) {
    add('advertencia', 'contradiccion',
      `El paciente negó fumar o vapear (P22) pero reportó consumo diario: "${listOf(a, '23')}" (P23).`);
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
  if (isYes(a, '21')) {
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
  const totalChars = JSON.stringify(doc).length;
  if (totalChars > 9000) {
    add('informativo', 'formato',
      'El documento es extenso y podría no caber en una sola página; revisar el diseño antes de aprobar.');
  }

  return {
    findings,
    blocked: findings.some((f) => f.level === 'bloqueante'),
    rulesVersion: AUDITOR_RULES_VERSION,
  };
}
