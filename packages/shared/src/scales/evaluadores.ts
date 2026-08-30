import { CODES, CODIGOS_ACORDEON, CODIGOS_DASI } from '../dictionary/codes';
import type { FormAnswers } from '../form';
import type { Facts } from '../rules';
import { normalizeValue } from '../rules';
import { categoriaDe, versionCortes } from './cutpoints';
import {
  deAgenda, deLaboratorio, derivado, incluyeAlguna, numero, opcion, puntuar,
  recolectar, ternaria, tienePatologia, total, type Resuelto,
} from './resolve';
import {
  noIndicada, pendiente, revisionClinica,
  type ScaleResult, type VariableEscala,
} from './types';

/**
 * Los ocho evaluadores de escalas. Funciones PURAS: sin base de datos, sin reloj.
 *
 * Reglas que comparten todas:
 *  - Una variable sin resolver deja la escala en `PENDIENTE`, nunca la asume.
 *  - "No sabe" no es "no" (CS10): `ternaria` devuelve faltante.
 *  - La categoría sólo se emite si los cortes están validados (CS9 / `cutpoints.ts`).
 *  - `recolectar` aplica CS9 a cada variable: procedencia inadmisible → faltante.
 */

/** Contexto que necesitan las escalas. */
export interface ContextoEscalas {
  answers: FormAnswers;
  facts: Facts;
  /** Laboratorios validados, por analito canónico. */
  labs?: Record<string, number | null | undefined>;
  /** SpO2 medida por el anestesiólogo. Nunca inferida (Especificación §13). */
  spo2?: number | null;
  /** Circunferencia de cuello medida en consulta, si el paciente no la aportó. */
  cuelloMedido?: number | null;
  /** Nombre del procedimiento programado (PX01). POVOC necesita reconocer el estrabismo. */
  procedimiento?: string | null;
}

/** Cierra una escala aditiva: puntúa, aplica cortes y decide el estado. */
function cerrar(
  escala: Parameters<typeof categoriaDe>[0],
  version: string,
  variables: VariableEscala[],
  faltantes: string[],
  violaciones: string[],
): ScaleResult {
  if (violaciones.length > 0) {
    return revisionClinica(escala, version, variables, violaciones.join(' '));
  }
  if (faltantes.length > 0) return pendiente(escala, version, variables, faltantes);
  const puntaje = total(variables);
  return {
    escala, version, cortesVersion: versionCortes(escala), estado: 'CALCULADA',
    puntaje, categoria: categoriaDe(escala, puntaje), variables, faltantes: [], motivo: null,
  };
}

const esAdulto = (f: Facts) => f.ruta === 'ADULTO' || f.ruta === 'ADULTO_MAYOR';

// ═════════════════════════════════════════════════════════════════════════════════════════
// DASI — capacidad funcional (Especificación §9)
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Pesos originales del instrumento. No se redondean ni se reescalan. */
const PESOS_DASI: Record<string, number> = {
  D01: 2.75, D02: 1.75, D03: 2.75, D04: 5.50, D05: 8.00, D06: 2.70,
  D07: 3.50, D08: 8.00, D09: 4.50, D10: 5.25, D11: 6.00, D12: 7.50,
};

export function evaluarDASI(ctx: ContextoEscalas): ScaleResult {
  const version = 'DASI@1';
  if (!esAdulto(ctx.facts)) return noIndicada('DASI', version, 'El DASI es un instrumento de adultos.');

  const respondidos = CODIGOS_DASI.filter((c) => ctx.answers[c] != null);
  if (respondidos.length === 0) {
    return noIndicada('DASI', version, 'El tamizaje funcional no requirió abrir el DASI completo.');
  }

  const variables: VariableEscala[] = [];
  const faltantes: string[] = [];
  for (const code of CODIGOS_DASI) {
    const r = opcion(ctx.answers, code, `Actividad ${code}`);
    if (!r.ok) { faltantes.push(r.falta); continue; }
    const v = normalizeValue(r.valor);
    // "No sabe" no puntúa, y "no la realiza pero podría" NO es incapacidad (Especificación §9).
    if (v === 'no sabe') { faltantes.push(`Actividad ${code}`); continue; }
    const puede = v === 'si' || v.startsWith('no la realiza');
    variables.push({ ...r.variable, puntos: puede ? (PESOS_DASI[code] ?? 0) : 0 });
  }
  return cerrar('DASI', version, variables, faltantes, []);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// STOP-Bang (Especificación §10)
// ═════════════════════════════════════════════════════════════════════════════════════════

export function evaluarSTOPBang(ctx: ContextoEscalas): ScaleResult {
  const version = 'STOP_BANG@1';
  if (!esAdulto(ctx.facts)) return noIndicada('STOP_BANG', version, 'Tamizaje de adultos.');

  const { answers: a, facts: f } = ctx;
  const imc = typeof f.imc === 'number' ? f.imc : null;
  const edad = typeof f.edad_anios === 'number' ? f.edad_anios : null;
  const sexo = typeof f.sexo_nacimiento === 'string' ? f.sexo_nacimiento : null;
  // El cuello lo puede aportar el paciente o medirlo el clínico (Especificación §10, SB06).
  const cuello = ctx.cuelloMedido ?? null;

  const items: Resuelto<unknown>[] = [
    ternaria(a, CODES.roncaFuerte, 'Ronquido (S)'),
    ternaria(a, CODES.cansancioDiurno, 'Cansancio diurno (T)'),
    ternaria(a, CODES.pausasRespiratorias, 'Pausas observadas (O)'),
    tienePatologia(a, CODIGOS_ACORDEON, ['Hipertensión arterial'], 'Hipertensión (P)'),
    derivado(imc == null ? null : imc > 35, 'IMC > 35 (B)', 'sistema:imc'),
    derivado(edad == null ? null : edad > 50, 'Edad > 50 (A)', 'sistema:edad'),
    cuello != null
      ? { ok: true as const, valor: cuello > 40,
          variable: { nombre: 'Cuello > 40 cm (N)', origen: 'anestesiologo:cuello',
                      valor: cuello > 40, fuente: 'anestesiologo:medicion' } }
      : numero(a, CODES.cuello, 'Circunferencia del cuello (N)'),
    derivado(sexo == null ? null : normalizeValue(sexo) === 'hombre', 'Sexo masculino (G)', 'sistema:sexo'),
  ];

  const { variables, faltantes, violaciones } = recolectar(items);
  // Cada ítem de STOP-Bang vale 1 punto.
  const conPuntos = variables.map((v) =>
    v.nombre.startsWith('Circunferencia')
      ? puntuar({ ...v, valor: Number(v.valor) > 40 }, 1)
      : puntuar(v, 1),
  );
  return cerrar('STOP_BANG', version, conPuntos, faltantes, violaciones);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// Apfel (Especificación §10, documento de módulos §4)
// ═════════════════════════════════════════════════════════════════════════════════════════

export function evaluarApfel(ctx: ContextoEscalas): ScaleResult {
  const version = 'APFEL@1';
  const { answers: a, facts: f } = ctx;
  if (!esAdulto(f)) {
    return noIndicada('APFEL', version, 'En pediatría se usa POVOC; Apfel adulto no aplica.');
  }
  const anestesia = f['px.anestesia_probable'];
  if (anestesia == null || anestesia === 'POR_DEFINIR') {
    return pendiente('APFEL', version, [], ['plan anestésico (anestesia probable)']);
  }

  const sexo = typeof f.sexo_nacimiento === 'string' ? f.sexo_nacimiento : null;
  const tabaco = opcion(a, CODES.tabaco, 'Condición de no fumador');
  const nvpo = ternaria(a, CODES.nvpoPrevio, 'Antecedente de NVPO');
  const cinetosis = ternaria(a, CODES.cinetosis, 'Cinetosis');
  const opioides = f['px.opioides_postop'];

  const items: Resuelto<unknown>[] = [
    derivado(sexo == null ? null : normalizeValue(sexo) === 'mujer', 'Sexo femenino', 'sistema:sexo'),
    tabaco.ok
      ? { ok: true as const, valor: normalizeValue(tabaco.valor) === 'nunca',
          variable: { ...tabaco.variable, nombre: 'No fumador',
                      valor: normalizeValue(tabaco.valor) === 'nunca' } }
      : tabaco,
    deAgenda(opioides == null ? null : Boolean(opioides), 'Opioides posoperatorios', 'PX11'),
  ];

  // AP01 y AP02 positivos son UN SOLO factor (documento de módulos §4): no se suman por separado.
  if (!nvpo.ok && !cinetosis.ok) {
    items.push({ ok: false, falta: 'Antecedente de NVPO o cinetosis' });
  } else {
    const hay = (nvpo.ok && nvpo.valor) || (cinetosis.ok && cinetosis.valor);
    items.push({
      ok: true,
      valor: hay,
      variable: {
        nombre: 'Antecedente de NVPO o cinetosis',
        origen: `${CODES.nvpoPrevio},${CODES.cinetosis}`,
        valor: hay,
        fuente: `formulario:${CODES.nvpoPrevio}, ${CODES.cinetosis}`,
      },
    });
  }

  const { variables, faltantes, violaciones } = recolectar(items);
  return cerrar('APFEL', version, variables.map((v) => puntuar(v, 1)), faltantes, violaciones);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// FRAIL (Especificación §11)
// ═════════════════════════════════════════════════════════════════════════════════════════

export function evaluarFRAIL(ctx: ContextoEscalas): ScaleResult {
  const version = 'FRAIL@1';
  const { answers: a, facts: f } = ctx;
  const edad = typeof f.edad_anios === 'number' ? f.edad_anios : null;
  const activaPorEdad = edad != null && edad >= 65;
  const activaPorPerfil = CODIGOS_DASI.length > 0 && a[CODES.fatiga] != null;
  if (!activaPorEdad && !activaPorPerfil) {
    return noIndicada('FRAIL', version, 'Menor de 65 años y sin disparadores de fragilidad.');
  }

  const items: Resuelto<unknown>[] = [
    ternaria(a, CODES.fatiga, 'Fatiga'),
    ternaria(a, CODES.resistencia, 'Resistencia (escaleras)'),
    ternaria(a, CODES.ambulacion, 'Deambulación (una cuadra)'),
    ternaria(a, CODES.cincoEnfermedades, 'Cinco o más enfermedades'),
    ternaria(a, CODES.perdidaPeso, 'Pérdida de peso > 5 %'),
  ];
  const { variables, faltantes, violaciones } = recolectar(items);
  return cerrar('FRAIL', version, variables.map((v) => puntuar(v, 1)), faltantes, violaciones);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// Caprini (Especificación §12)
// ═════════════════════════════════════════════════════════════════════════════════════════

export function evaluarCaprini(ctx: ContextoEscalas): ScaleResult {
  const version = 'CAPRINI@1';
  const { answers: a, facts: f } = ctx;
  if (a[CODES.tvpPrevia] == null) {
    return noIndicada('CAPRINI', version, 'El contexto quirúrgico no activó el módulo tromboembólico.');
  }
  const edad = typeof f.edad_anios === 'number' ? f.edad_anios : null;
  const imc = typeof f.imc === 'number' ? f.imc : null;

  // Puntos por edad, versión 2005.
  const puntosEdad = edad == null ? null : edad >= 75 ? 3 : edad >= 61 ? 2 : edad >= 41 ? 1 : 0;

  const items: Resuelto<unknown>[] = [
    derivado(puntosEdad, 'Edad', 'sistema:edad'),
    derivado(imc == null ? null : imc > 25, 'IMC > 25', 'sistema:imc'),
    ternaria(a, CODES.tvpPrevia, 'TVP o embolia previa'),
    ternaria(a, CODES.tvpFamiliar, 'Antecedente familiar de trombosis'),
    ternaria(a, CODES.varices, 'Várices'),
    ternaria(a, CODES.reposoCama, 'Reposo en cama ≥ 3 días'),
    ternaria(a, CODES.inmovilizador, 'Yeso o inmovilizador'),
    ternaria(a, CODES.eii, 'Enfermedad inflamatoria intestinal'),
    ternaria(a, CODES.cateterCentral, 'Catéter venoso central'),
    incluyeAlguna(a, CODES.trombofilia,
      ['Factor V Leiden', 'Mutación de protrombina 20210A', 'Homocisteína elevada',
       'Anticoagulante lúpico', 'Anticardiolipinas',
       'Déficit de proteína C, S o antitrombina', 'Trombocitopenia por heparina', 'Otra'],
      'Trombofilia'),
    incluyeAlguna(a, CODES.sepsisNeumoniaInfarto, ['Sepsis', 'Neumonía', 'Infarto'],
      'Sepsis, neumonía o infarto reciente'),
    incluyeAlguna(a, CODES.cancerQuimio, ['Cáncer activo', 'Quimioterapia', 'Ambos'], 'Cáncer activo'),
    incluyeAlguna(a, CODES.eventoMayor,
      ['Accidente cerebrovascular', 'Fractura de cadera, pelvis o pierna', 'Trauma mayor', 'Lesión medular'],
      'Evento mayor reciente'),
  ];

  const { variables, faltantes, violaciones } = recolectar(items);
  const conPuntos = variables.map((v) => {
    if (v.nombre === 'Edad') return { ...v, puntos: Number(v.valor) };
    // Factores de 2 puntos en la versión 2005.
    const dosPuntos = ['Evento mayor reciente', 'Cáncer activo', 'Reposo en cama ≥ 3 días',
      'Yeso o inmovilizador', 'Catéter venoso central'];
    if (dosPuntos.includes(v.nombre)) return puntuar(v, 2);
    if (v.nombre === 'TVP o embolia previa' || v.nombre === 'Trombofilia') return puntuar(v, 3);
    return puntuar(v, 1);
  });
  return cerrar('CAPRINI', version, conPuntos, faltantes, violaciones);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// RCRI (Especificación §13) — sin cuestionario propio
// ═════════════════════════════════════════════════════════════════════════════════════════

export function evaluarRCRI(ctx: ContextoEscalas): ScaleResult {
  const version = 'RCRI@1';
  const { answers: a, facts: f } = ctx;
  if (!esAdulto(f)) return noIndicada('RCRI', version, 'Instrumento de adultos.');

  const altoRiesgo = f['px.alto_riesgo_rcri'];
  const creatinina = ctx.labs?.['creatinina'];

  const items: Resuelto<unknown>[] = [
    deAgenda(altoRiesgo == null ? null : Boolean(altoRiesgo), 'Cirugía de alto riesgo', 'PX09'),
    tienePatologia(a, CODIGOS_ACORDEON,
      ['Enfermedad coronaria o angina', 'Infarto de miocardio'], 'Cardiopatía isquémica'),
    tienePatologia(a, CODIGOS_ACORDEON, ['Insuficiencia cardíaca'], 'Insuficiencia cardíaca'),
    tienePatologia(a, CODIGOS_ACORDEON,
      ['Accidente cerebrovascular o isquemia transitoria'], 'Enfermedad cerebrovascular'),
    // La insulina se reutiliza de "Antecedentes + medicamentos" (Especificación §13). Si el
    // paciente no abrió el módulo farmacológico, RX05 no se le mostró: preguntar por él dejaría
    // RCRI pendiente para siempre. Los acordeones sí se responden siempre que declare enfermedad.
    a[CODES.insulina] != null
      ? ternaria(a, CODES.insulina, 'Diabetes tratada con insulina')
      : tienePatologia(a, CODIGOS_ACORDEON, ['Uso de insulina'], 'Diabetes tratada con insulina'),
    // La creatinina NO se le pide al paciente: sale del laboratorio validado.
    creatinina == null
      ? { ok: false as const, falta: 'Creatinina (laboratorio validado)' }
      : { ok: true as const, valor: creatinina > 2.0,
          variable: { nombre: 'Creatinina > 2 mg/dL', origen: 'lab:creatinina',
                      valor: creatinina, fuente: 'lab:creatinina' } },
  ];

  const { variables, faltantes, violaciones } = recolectar(items);
  return cerrar('RCRI', version, variables.map((v) => puntuar(v, 1)), faltantes, violaciones);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ARISCAT (Especificación §13)
// ═════════════════════════════════════════════════════════════════════════════════════════

export function evaluarARISCAT(ctx: ContextoEscalas): ScaleResult {
  const version = 'ARISCAT@1';
  const { answers: a, facts: f } = ctx;
  const edad = typeof f.edad_anios === 'number' ? f.edad_anios : null;
  const hb = ctx.labs?.['hemoglobina'];
  const sitio = f['px.sitio_quirurgico'];
  const duracion = f['px.duracion_estimada'];
  const prioridad = f['px.prioridad'];

  // La SpO2 la mide el anestesiólogo. La Especificación lo dice sin matices: "nunca inferirla ni
  // pedir que la adivine". Si no está medida, ARISCAT queda pendiente.
  const spo2 = ctx.spo2 ?? null;

  const puntosEdad = edad == null ? null : edad > 80 ? 16 : edad > 50 ? 3 : 0;
  const puntosSpo2 = spo2 == null ? null : spo2 <= 90 ? 24 : spo2 <= 95 ? 8 : 0;
  const puntosSitio = sitio == null ? null
    : sitio === 'INTRATORACICO' ? 24 : sitio === 'ABDOMINAL_SUPERIOR' ? 15 : 0;
  const puntosDuracion = duracion == null || duracion === 'NO_DEFINIDA' ? null
    : duracion === 'MAYOR_3H' ? 23 : duracion === 'ENTRE_2_Y_3H' ? 16 : 0;

  const items: Resuelto<unknown>[] = [
    derivado(puntosEdad, 'Edad', 'sistema:edad'),
    spo2 == null
      ? { ok: false as const, falta: 'SpO2 preoperatoria (la mide el anestesiólogo)' }
      : { ok: true as const, valor: puntosSpo2!,
          variable: { nombre: 'SpO2 preoperatoria', origen: 'anestesiologo:spo2',
                      valor: spo2, fuente: 'anestesiologo:medicion', puntos: puntosSpo2! } },
    opcion(a, CODES.infeccionRespiratoria, 'Infección respiratoria en el último mes'),
    deLaboratorio(hb == null ? null : hb, 'Hemoglobina', 'hemoglobina'),
    deAgenda(puntosSitio, 'Sitio quirúrgico', 'PX07'),
    deAgenda(puntosDuracion, 'Duración estimada', 'PX08'),
    deAgenda(prioridad == null ? null : String(prioridad), 'Prioridad', 'PX06'),
  ];

  const { variables, faltantes, violaciones } = recolectar(items);
  const conPuntos = variables.map((v) => {
    switch (v.nombre) {
      case 'Edad':
      case 'Sitio quirúrgico':
      case 'Duración estimada':
        return { ...v, puntos: Number(v.valor) };
      case 'SpO2 preoperatoria':
        return v; // ya trae sus puntos
      case 'Infección respiratoria en el último mes':
        return { ...v, puntos: normalizeValue(v.valor) === 'no' ? 0 : 17 };
      case 'Hemoglobina':
        return { ...v, puntos: Number(v.valor) <= 10 ? 11 : 0 };
      case 'Prioridad':
        return { ...v, puntos: v.valor === 'EMERGENCIA' ? 8 : 0 };
      default:
        return v;
    }
  });
  return cerrar('ARISCAT', version, conPuntos, faltantes, violaciones);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// POVOC — pediátrico (Especificación §14)
// ═════════════════════════════════════════════════════════════════════════════════════════

export function evaluarPOVOC(ctx: ContextoEscalas): ScaleResult {
  const version = 'POVOC@1';
  const { answers: a, facts: f } = ctx;
  if (f.ruta !== 'PEDIATRICA') {
    return noIndicada('POVOC', version, 'POVOC es pediátrico; en adultos se usa Apfel.');
  }
  const edad = typeof f.edad_anios === 'number' ? f.edad_anios : null;
  const duracion = f['px.duracion_estimada'];
  // "Cirugía de estrabismo" es un PROCEDIMIENTO, no una especialidad. Antes se comparaba la
  // especialidad contra 'oftalmologia', un valor que ni siquiera existía en el enum: el factor
  // no puntuaba nunca y nada fallaba a la vista.
  const nombreProc = ctx.procedimiento ?? null;
  const esEstrabismo = nombreProc == null ? null : /estrabism/i.test(nombreProc);

  const items: Resuelto<unknown>[] = [
    derivado(edad == null ? null : edad >= 3, 'Edad ≥ 3 años', 'sistema:edad'),
    deAgenda(
      duracion == null || duracion === 'NO_DEFINIDA' ? null : duracion !== 'MENOR_2H',
      'Duración > 30 minutos', 'PX08',
    ),
    deAgenda(esEstrabismo, 'Cirugía de estrabismo', 'PX01'),
    opcion(a, CODES.vomitoPrevio, 'Antecedente personal o familiar de vómito posoperatorio'),
  ];

  const { variables, faltantes, violaciones } = recolectar(items);
  const conPuntos = variables.map((v) =>
    v.nombre.startsWith('Antecedente')
      ? { ...v, puntos: normalizeValue(v.valor) === 'ninguno' ? 0 : 1 }
      : puntuar(v, 1),
  );
  return cerrar('POVOC', version, conPuntos, faltantes, violaciones);
}

/** Las ocho, en el orden en que se muestran. */
export function evaluarTodas(ctx: ContextoEscalas): ScaleResult[] {
  return [
    evaluarDASI(ctx), evaluarSTOPBang(ctx), evaluarApfel(ctx), evaluarFRAIL(ctx),
    evaluarCaprini(ctx), evaluarRCRI(ctx), evaluarARISCAT(ctx), evaluarPOVOC(ctx),
  ];
}
