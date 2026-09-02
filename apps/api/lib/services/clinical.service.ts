import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../prisma';
import { getScalesForCase } from './scales.service';
import { activeModelLabel, getAIProvider, type ClinicalInput } from '../ai';
import { logAudit } from '../audit';
import {
  aSnapshots,
  computeIMC,
  computeAge,
  enforceGuardrails,
  documentSchema,
  detectGLP1,
  groupLabsToProse,
  parseNumeric,
  isAmbiguousProcedure,
  autoCorrectTerm,
  PROMPT_MAESTRO_VERSION,
  type DocField,
  type FormAnswers,
  CODES,
  getMulti,
  getClinicalText,
  getText,
  NOMBRE_ESCALA,
  agruparEstudios,
  normalizeGrupo,
  calcularTendencias,
  describirTendencia,
  soloMasReciente,
} from '@anestia/shared';

/** Carga el system prompt (prompt-maestro-v2) desde docs/. */
export async function loadPromptMaestro(): Promise<string> {
  try {
    return await readFile(join(process.cwd(), '..', '..', 'docs', 'prompt-maestro-v2.md'), 'utf8');
  } catch {
    return '';
  }
}

/** Ensambla el ClinicalInput desde el caso (respuestas + labs + GLP-1 + IMC por código). */
export async function assembleInput(caseId: string): Promise<ClinicalInput> {
  const fr = await prisma.formResponse.findUnique({ where: { caseId } });
  const labs = await prisma.extractedLabResult.findMany({ where: { caseId } });
  const kase = await prisma.case.findUnique({ where: { id: caseId }, include: { schedule: true } });
  const answers = (fr?.answers as FormAnswers) ?? {};

  // GLP-1: ahora hay un módulo estructurado (GL01) además del texto libre de medicamentos.
  // Se mira primero el módulo, y el texto libre queda como red de seguridad para lo que el
  // paciente escriba por su cuenta.
  const glp1Modulo = getMulti(answers, CODES.glp1).filter(
    (o) => !/^(ninguno|no sabe)$/i.test(o.trim()),
  );
  const glp1 = glp1Modulo.length > 0
    ? { declared: true, drug: glp1Modulo.join(', ') }
    : detectGLP1(getClinicalText(answers, CODES.listaMedicamentos) + ' ' + getText(answers, CODES.naturales));

  // parseNumeric normaliza la coma decimal ("78,5"→78.5) — un paciente que teclea coma no
  // debe hacer que el IMC se caiga en silencio (C-3). Un solo helper compartido para todos
  // los sitios de lectura de peso/talla.
  const peso = parseNumeric(getText(answers, CODES.peso));
  const talla = parseNumeric(getText(answers, CODES.talla));
  const pesoKg = peso != null && peso > 0 ? peso : null;
  const tallaCm = talla != null && talla > 0 ? talla : null;
  const imc = pesoKg != null && tallaCm != null ? computeIMC(pesoKg, tallaCm) : null;

  // Edad: nacimiento (ID03) contra la fecha del procedimiento — misma base que el documento y
  // sin Date.now. La fecha viene de la AGENDA, no del paciente: la Especificación es explícita
  // en que el acto quirúrgico no lo describe el paciente.
  const birth = getText(answers, CODES.fechaNacimiento) || null;
  const agendaFecha = kase?.schedule?.fechaHora ?? kase?.procedureDate ?? null;
  const ref = agendaFecha ? agendaFecha.toISOString().slice(0, 10) : null;
  const edad = computeAge(birth, ref);

  return {
    caseId,
    answers,
    procedimiento: kase?.schedule?.procedimiento ?? kase?.procedure ?? null,
    diagnosticoPreop: kase?.schedule?.diagnosticoPreop ?? null,
    fechaProcedimiento: ref,
    pesoKg,
    tallaCm,
    edad,
    labs: labs.map((l) => ({
      analyte: l.analyte,
      value: l.value,
      unit: l.unit,
      grupo: l.grupo,
      reportDate: l.reportDate ? l.reportDate.toISOString().slice(0, 10) : null,
      flag: l.flag,
      sourceRef: l.sourceRef,
    })),
    glp1,
    imc,
  };
}

/**
 * Genera el borrador estructurado: IMC por código → provider → valida documentSchema →
 * enforceGuardrails (CS2/CS3/CS4) → persiste GeneratedAssessment. Idempotente.
 */
/**
 * Arma la sección de paraclínicos desde los labs realmente extraídos (código, no IA).
 * Una fila por TIPO DE ESTUDIO (hemograma, coagulación…) con los analitos en prosa, en vez
 * de una fila por analito: así el documento no crece sin control. El tipo lo trae el
 * extractor desde el informe; lo no reconocido cae en "otros" (CS2).
 * Si el proveedor ya devolvió paraclínicos, se respetan.
 */
function buildParaclinicos(
  labs: ClinicalInput['labs'],
  provided: Record<string, DocField> | undefined,
  hoy: string,
): Record<string, DocField> {
  if (provided && Object.keys(provided).length > 0) return provided;
  const out: Record<string, DocField> = {};
  // Un analito con varios informes se lista una vez, con el más reciente (§16). Los anteriores
  // siguen en la base y son los que sustentan la nota de evolución; repetirlos aquí se leería
  // como dos analitos distintos en vez de una caída.
  for (const g of groupLabsToProse(soloMasReciente(labs ?? []), hoy)) {
    out[g.grupo] = {
      valor: g.texto,
      estado: 'ok',
      fuente: g.fuentes.length ? g.fuentes.join(', ') : 'lab',
      alerta: g.alerta,
    };
  }
  return out;
}

/**
 * Flag EFECTIVO de un lab para la prosa del documento (Opción 1 — se congela al aprobar):
 *  - el médico marcó (`manualFlag`) → manda su veredicto.
 *  - no marcó y el sistema pudo leer el rango → manda el veredicto del sistema (`flag`).
 *  - no marcó y el rango era ilegible (`rangeUnparsed`) → se EXCLUYE de la prosa: no es normal
 *    ni alteración confirmada; si el médico no lo revisó, no lo declaramos alterado ni en rango.
 * Devuelve el flag efectivo, o null si el lab debe excluirse de la prosa.
 */
export function effectiveFlagForProse(l: { flag: string; manualFlag: string | null; rangeUnparsed: boolean }): string | null {
  if (l.manualFlag != null) return l.manualFlag;
  if (l.rangeUnparsed) return null; // no revisado + rango ilegible → fuera de la prosa
  return l.flag;
}

/**
 * Regenera SÓLO la sección paraclínicos con los flags EFECTIVOS (manual ?? sistema), para
 * congelarla en el documento al aprobar. Prosa determinística (groupLabsToProse), sin IA. NO
 * toca concepto/plan/recomendaciones (prosa clínica que el médico ya revisó con contexto).
 */
export async function regenerateParaclinicos(caseId: string, hoy: string): Promise<Record<string, DocField>> {
  const labs = await prisma.extractedLabResult.findMany({ where: { caseId } });
  const groupable = labs
    .map((l) => ({ lab: l, eff: effectiveFlagForProse(l) }))
    .filter((x) => x.eff !== null) // excluye los ilegibles sin revisar
    .map(({ lab, eff }) => ({
      analyte: lab.analyte,
      value: lab.value,
      unit: lab.unit,
      grupo: lab.grupo,
      reportDate: lab.reportDate ? lab.reportDate.toISOString().slice(0, 10) : null,
      flag: eff, // flag efectivo, no el crudo del sistema
      sourceRef: lab.sourceRef,
    }));

  const out: Record<string, DocField> = {};
  for (const g of groupLabsToProse(soloMasReciente(groupable), hoy)) {
    out[g.grupo] = {
      valor: g.texto,
      estado: 'ok',
      fuente: g.fuentes.length ? g.fuentes.join(', ') : 'lab',
      alerta: g.alerta,
    };
  }
  // La evolución y los estudios se recalculan aquí también. Si sólo se anotaran al generar, el
  // congelado del documento aprobado los perdería — y el PDF firmado diría menos que el borrador.
  anotarTendencias(out, await tendenciasDeCaso(caseId));
  Object.assign(out, await estudiosDeCaso(caseId));
  await marcarSinConfirmar(caseId, out);
  return out;
}

/** Texto plano de una respuesta del formulario (string, o array unido). null si vacía. */
function valorTexto(v: unknown): string | null {
  if (v == null) return null;
  const s = Array.isArray(v) ? v.join(', ') : String(v);
  return s.trim() || null;
}

export async function generateForCase(caseId: string): Promise<void> {
  const existing = await prisma.generatedAssessment.findUnique({ where: { caseId } });
  if (existing) return;

  const kase = await prisma.case.findUnique({ where: { id: caseId }, include: { schedule: true } });
  const input = await assembleInput(caseId);
  const raw = await getAIProvider().generateAssessment(input);

  // Paraclínicos y ESCALAS: los arma el CÓDIGO, nunca el modelo. Los valores del documento son
  // los del laboratorio y los puntajes son determinísticos, no lo que el modelo recuerde (CS2).
  const withParaclinicos = {
    ...raw,
    paraclinicos: buildParaclinicos(input.labs, raw.paraclinicos, new Date().toISOString().slice(0, 10)),
    escalas: await buildEscalas(caseId),
  };

  // Tendencia: si un analito tiene resultados sucesivos, el cambio se anota junto al valor. Una
  // hemoglobina de 9.8 que viene de 13.9 en tres semanas es una historia distinta de una que
  // lleva un año igual, y el documento sólo mostraba la última cifra (Especificación §16).
  anotarTendencias(withParaclinicos.paraclinicos, await tendenciasDeCaso(caseId));

  // Informes que no son de laboratorio (ECG, ecocardiograma, radiografía, espirometría). El
  // extractor los descartaba enteros: era seguro —no inventaba nada— pero el dato no le llegaba
  // al médico. Se transcriben; no se interpretan y no alimentan escalas (§16).
  Object.assign(withParaclinicos.paraclinicos, await estudiosDeCaso(caseId));
  await marcarSinConfirmar(caseId, withParaclinicos.paraclinicos);

  // Validación de contrato (rechaza malformado / campos prohibidos) — CS5.
  const parsed = documentSchema.parse(withParaclinicos);

  // Guardarraíles (segunda línea) — CS2/CS3/CS4. peso/talla/IMC se fuerzan a los datos reales
  // del paciente: el modelo no decide esos números (evita el 71/188 fabricado sobre 78/193).
  //
  // Los signos vitales YA NO se estiman. Antes se proponía un rango de referencia en standby
  // cuando el paciente no declaraba comorbilidades, y ese texto incluía "SatO₂ ≥ 96 %" — una
  // saturación verosímil que nadie midió, en el único punto del sistema que la escribe. La
  // Especificación exige que la SpO2 se mida ("nunca inferirla") porque alimenta ARISCAT, y el
  // campo bloqueaba la aprobación de todas formas, así que el estimado no aportaba nada.
  const doc = enforceGuardrails(parsed, {
    imc: input.imc ?? null,
    pesoKg: input.pesoKg,
    tallaCm: input.tallaCm,
    edad: input.edad ?? null,
  });

  // Capacidad funcional: se restituye desde el DASI, que SÍ la mide (D01-D12 con sus pesos
  // originales). Antes se afirmaba "≥ 4 METs" derivándolo de que el paciente no declarara
  // enfermedades — una invención. Ahora, o hay un DASI calculado que la sustente, o el campo
  // queda sin reportar hasta la evaluación presencial (CS4).
  const dasi = await prisma.scaleResult.findUnique({
    where: { caseId_escala: { caseId, escala: 'DASI' } },
  });
  if (dasi?.estado === 'CALCULADA' && dasi.puntaje != null) {
    doc.identificacion['capacidad_funcional'] = {
      valor: `${dasi.puntaje.toFixed(1)} puntos DASI`,
      estado: 'ok',
      fuente: `escala:${dasi.version}`,
      nota: dasi.categoria
        ? dasi.categoria
        : 'Interpretación pendiente de validación institucional de los puntos de corte.',
    };
  }

  // Procedimiento ambiguo ("operación de la nariz"): el modelo tiende a elegir una cirugía
  // específica (rinoplastia) por sesgo, pero eso es inventar el procedimiento — en anestesia el
  // manejo depende de cuál sea. Guardarraíl determinístico: si el procedimiento programado es
  // ambiguo, se conserva su texto original, sin importar lo que puso el modelo.
  const procOriginal = kase?.schedule?.procedimiento ?? kase?.procedure ?? null;
  if (procOriginal && isAmbiguousProcedure(procOriginal)) {
    const fuente = 'agenda:PX01';
    doc.identificacion['procedimiento'] = { valor: procOriginal, estado: 'ok', fuente };
    if (doc.identificacion['diagnostico_preoperatorio']) {
      doc.identificacion['diagnostico_preoperatorio'] = { valor: procOriginal, estado: 'ok', fuente };
    }
  }

  // Auto-corrección de terminología ANTES del auditor: aplica la traducción médica cuando es
  // SEGURA y sin pérdida (coloquialismo unívoco, sin calificadores). Así el borrador que ve el
  // médico ya trae el término correcto y el auditor no lo molesta con algo que el sistema puede
  // arreglar solo. Los casos con contexto ("candidato a…") o ambiguos NO se tocan: autoCorrectTerm
  // devuelve null y el auditor los deja como advertencia para el criterio del médico.
  const correcciones: { campo: string; de: string; a: string }[] = [];
  for (const clave of ['procedimiento', 'diagnostico_preoperatorio'] as const) {
    const f = doc.identificacion[clave];
    if (f?.estado !== 'ok' || f.valor == null) continue;
    const original = String(f.valor);
    const corregido = autoCorrectTerm(original);
    if (corregido && corregido !== original) {
      doc.identificacion[clave] = { ...f, valor: corregido, nota: 'terminología normalizada por el sistema' };
      correcciones.push({ campo: clave, de: original, a: corregido });
    }
  }

  // Trazabilidad: la etiqueta la da el propio adaptador (un solo punto de verdad).
  const modelUsed = activeModelLabel();

  await prisma.generatedAssessment.create({
    data: {
      caseId,
      fields: doc as never,
      promptVersion: PROMPT_MAESTRO_VERSION,
      modelUsed,
    },
  });

  await logAudit({
    action: 'clinical.generated',
    entity: 'Case',
    entityId: caseId,
    meta: { modelUsed, ...(correcciones.length ? { terminologiaCorregida: correcciones } : {}) },
  });
}

/**
 * Escalas del documento. Se leen de `ScaleResult`, que es la fuente de verdad; el documento es
 * una proyección. Las `NO_INDICADA` se omiten del documento —no aportan nada al lector— pero se
 * conservan en la base con su motivo, para poder auditar por qué no se aplicaron.
 */
async function buildEscalas(caseId: string) {
  const filas = await getScalesForCase(caseId);
  return aSnapshots(filas);
}

/** Tendencias de los analitos del caso con más de un resultado fechado. */
async function tendenciasDeCaso(caseId: string) {
  const filas = await prisma.extractedLabResult.findMany({
    where: { caseId, estadoExtraccion: { not: 'PENDIENTE_CONFIRMACION' } },
  });
  return calcularTendencias(filas);
}

/**
 * Anota la tendencia en la fila del estudio correspondiente.
 *
 * Se añade al texto existente en vez de sustituirlo: el valor actual con su rango sigue siendo
 * lo primero que lee el anestesiólogo, y la evolución va detrás.
 */
function anotarTendencias(
  paraclinicos: Record<string, DocField>,
  tendencias: ReturnType<typeof calcularTendencias>,
): void {
  if (tendencias.length === 0) return;
  const relevantes = tendencias.filter((t) => t.direccion !== 'estable');
  if (relevantes.length === 0) return;

  for (const campo of Object.values(paraclinicos)) {
    if (campo?.valor == null) continue;
    const propias = relevantes.filter((t) =>
      campo.valor!.toLowerCase().includes(t.analito.toLowerCase()),
    );
    if (propias.length === 0) continue;

    campo.nota = `Evolución — ${propias.map((t) => `${t.analito}: ${describirTendencia(t)}`).join(' · ')}`;
    // El valor previo que cita la nota ya no aparece en la prosa; su informe se añade a la
    // procedencia del campo para que la cifra siga siendo rastreable (CS2).
    const previas = propias.map((t) => t.previoSourceRef).filter((r): r is string => !!r);
    if (previas.length > 0) {
      const fuente = typeof campo.fuente === 'string' ? campo.fuente : '';
      const faltan = previas.filter((r) => !fuente.includes(r));
      if (faltan.length > 0) campo.fuente = [fuente, ...faltan].filter(Boolean).join(', ');
    }
  }
}

/**
 * Estudios no-laboratorio del caso, ya en prosa, listos para la banda de paraclínicos.
 *
 * Uno pendiente de confirmación se muestra **diciendo que lo está**: ocultarlo le esconde al
 * médico un ECG que existe, y darlo por bueno le presenta como leído lo que el extractor no
 * pudo leer bien.
 */
async function estudiosDeCaso(caseId: string): Promise<Record<string, DocField>> {
  const filas = await prisma.extractedStudy.findMany({ where: { caseId } });
  const out: Record<string, DocField> = {};
  for (const g of agruparEstudios(filas)) {
    out[g.clave] = {
      valor: g.texto,
      estado: 'ok',
      fuente: g.fuentes.length ? g.fuentes.join(', ') : 'estudio',
      ...(g.pendiente
        ? { nota: 'Lectura pendiente de confirmación: verifique contra el informe original.' }
        : {}),
    };
  }
  return out;
}

/**
 * Marca en el documento los grupos que contienen alguna lectura sin confirmar.
 *
 * El valor se muestra igual —perderlo sería peor— pero el documento tiene que decir que esa
 * cifra no alimentó las escalas. Sin la marca, un puntaje `PENDIENTE` y un laboratorio visible
 * en la misma página se contradicen sin explicación.
 */
async function marcarSinConfirmar(
  caseId: string,
  paraclinicos: Record<string, DocField>,
): Promise<void> {
  const dudosos = await prisma.extractedLabResult.findMany({
    where: { caseId, estadoExtraccion: 'PENDIENTE_CONFIRMACION' },
    select: { analyte: true, grupo: true },
  });
  if (dudosos.length === 0) return;

  const porGrupo = new Map<string, string[]>();
  for (const d of dudosos) {
    const g = normalizeGrupo(d.grupo);
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), d.analyte]);
  }

  for (const [grupo, analitos] of porGrupo) {
    const campo = paraclinicos[grupo];
    if (!campo) continue;
    const nombres = [...new Set(analitos)];
    // Con pocos, se nombran: el médico sabe cuál mirar. Con muchos, se cuentan — un informe de
    // 20 analitos producía una nota de 500 caracteres que en una página a una columna es un
    // muro de texto, y un muro no se lee.
    const aviso =
      nombres.length <= 3
        ? `Sin confirmar: ${nombres.join(', ')}.`
        : `${nombres.length} lecturas de este grupo están sin confirmar.`;
    const cola = ' No alimentan escalas hasta verificar la lectura contra el informe.';
    campo.nota = campo.nota ? `${campo.nota} · ${aviso}${cola}` : `${aviso}${cola}`;
  }
}
