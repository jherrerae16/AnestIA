import { describe, it, expect } from 'vitest';
import {
  scheduleSchema,
  createCaseSchema,
  scheduleToFacts,
  faltantesDeAgenda,
  type ScheduleDef,
} from './schedule';
import { buildFacts } from './facts';
import { buildScreens, visibleQuestions } from './form-engine';
import { QUESTION_DICTIONARY, CODES } from './dictionary';
import type { QuestionDef } from './preset';
import type { FormAnswers } from './form';

const DICT: QuestionDef[] = QUESTION_DICTIONARY.filter((q) => q.fuente === 'P').map((q) => ({
  code: q.code, order: q.order, label: q.label, type: q.type,
  required: q.obligacion === 'O', obligacion: q.obligacion, seccion: q.seccion,
  grupo: q.grupo ?? null, modulo: q.modulo ?? null, ayuda: q.ayuda ?? null,
  alimenta: [...(q.alimenta ?? [])], options: q.opciones ? [...q.opciones] : null,
  repiteSobre: q.repiteSobre ?? null, campos: q.campos ? [...q.campos] : null,
  validacion: q.validacion ?? null,
  conditional: q.activacion ?? null,
}));

const adulto: FormAnswers = { [CODES.fechaNacimiento]: { value: '1985-03-12', type: 'FECHA' } };

const agenda = (over: Partial<ScheduleDef> = {}): ScheduleDef => ({
  procedimiento: 'Colecistectomía laparoscópica',
  diagnosticoPreop: 'Colelitiasis',
  fechaHora: '2026-10-15',
  especialidad: 'GENERAL',
  modalidad: 'HOSPITALIZACION',
  prioridad: 'ELECTIVA',
  sitioQuirurgico: 'ABDOMINAL_SUPERIOR',
  duracionEstimada: 'ENTRE_2_Y_3H',
  altoRiesgoRcri: false,
  anestesiaProbable: 'GENERAL',
  opioidesPostop: true,
  ...over,
});

const facts = (s: ScheduleDef | null) =>
  buildFacts({ answers: adulto, schedule: scheduleToFacts(s), refDateISO: '2026-10-15' });

describe('contrato de la agenda', () => {
  it('sólo exige el procedimiento', () => {
    expect(scheduleSchema.safeParse({ procedimiento: 'Rinoplastia' }).success).toBe(true);
  });

  it('rechaza un valor fuera del enum', () => {
    const r = scheduleSchema.safeParse({ procedimiento: 'Rinoplastia', sitioQuirurgico: 'abdominal alto' });
    expect(r.success).toBe(false);
  });

  it('crear un caso exige preset y agenda', () => {
    expect(createCaseSchema.safeParse({ presetId: 'p1' }).success).toBe(false);
    expect(
      createCaseSchema.safeParse({ presetId: 'p1', schedule: { procedimiento: 'Rinoplastia' } }).success,
    ).toBe(true);
  });

  it('distingue "sin definir" de "no"', () => {
    // null en RCRI significa "pendiente de clasificación", no "no es de alto riesgo".
    const s = scheduleSchema.parse({ procedimiento: 'Rinoplastia', altoRiesgoRcri: null });
    expect(s.altoRiesgoRcri).toBeNull();
    expect(faltantesDeAgenda(s)).toContain('clasificación de riesgo cardiovascular (RCRI)');
  });
});

describe('faltantesDeAgenda', () => {
  it('con la agenda completa no falta nada', () => {
    expect(faltantesDeAgenda(agenda())).toEqual([]);
  });

  it('sin agenda lo reporta entero', () => {
    expect(faltantesDeAgenda(null)).toEqual(['toda la programación quirúrgica']);
  });

  it('trata "no definida" como faltante, no como respuesta', () => {
    const s = agenda({ modalidad: 'NO_DEFINIDA', duracionEstimada: 'NO_DEFINIDA' });
    expect(faltantesDeAgenda(s)).toContain('modalidad');
    expect(faltantesDeAgenda(s)).toContain('duración estimada');
  });
});

// ── Lo que la agenda realmente destraba ──────────────────────────────────────────────────

describe('la agenda abre las ramas que dependen del procedimiento', () => {
  it('sin agenda, Caprini no se le pregunta al paciente', () => {
    const vis = visibleQuestions(DICT, adulto, facts(null)).map((q) => q.code);
    expect(vis).not.toContain('TE01');
  });

  it('con cirugía mayor hospitalizada, Caprini se abre', () => {
    const vis = visibleQuestions(DICT, adulto, facts(agenda())).map((q) => q.code);
    expect(vis).toContain('TE01');
    expect(vis).toContain('TE12');
  });

  it('una cirugía ambulatoria corta y periférica NO abre Caprini', () => {
    const s = agenda({
      modalidad: 'AMBULATORIA', especialidad: 'ORL',
      sitioQuirurgico: 'PERIFERICO', duracionEstimada: 'MENOR_2H',
    });
    expect(visibleQuestions(DICT, adulto, facts(s)).map((q) => q.code)).not.toContain('TE01');
  });

  it('un sitio quirúrgico elevado abre el DASI completo', () => {
    // Especificación §9: el DASI se abre con cirugía elevada aunque el tamizaje sea normal.
    const sinSintomas: FormAnswers = {
      ...adulto,
      [CODES.escaleras]: { value: 'Sí', type: 'SELECCION_UNICA' },
      [CODES.caminar]: { value: 'Sí', type: 'SELECCION_UNICA' },
      [CODES.sintomasActuales]: { value: ['Ninguno'], type: 'SELECCION_MULTIPLE' },
    };
    const conFacts = (s: ScheduleDef) =>
      buildFacts({ answers: sinSintomas, schedule: scheduleToFacts(s), refDateISO: '2026-10-15' });

    const periferica = agenda({ sitioQuirurgico: 'PERIFERICO', modalidad: 'AMBULATORIA', especialidad: 'ORL', duracionEstimada: 'MENOR_2H' });
    const toracica = agenda({ sitioQuirurgico: 'INTRATORACICO' });

    expect(visibleQuestions(DICT, sinSintomas, conFacts(periferica)).map((q) => q.code)).not.toContain('D01');
    expect(visibleQuestions(DICT, sinSintomas, conFacts(toracica)).map((q) => q.code)).toContain('D01');
  });

  it('la agenda cambia el recorrido sin añadirle preguntas de programación al paciente', () => {
    const conAgenda = buildScreens(DICT, adulto, facts(agenda()));
    const sinAgenda = buildScreens(DICT, adulto, facts(null));
    expect(conAgenda.length).toBeGreaterThan(sinAgenda.length);
    // Ni una sola PX llega al paciente, con agenda o sin ella.
    for (const s of [...conAgenda, ...sinAgenda]) {
      for (const q of s.questions) expect(q.code.startsWith('PX')).toBe(false);
    }
  });
});

describe('scheduleToFacts', () => {
  it('pasa los valores de enum, no las etiquetas traducidas', () => {
    // Las reglas del diccionario comparan contra el enum: una etiqueta ("Abdominal superior")
    // rompería la activación en silencio.
    const f = scheduleToFacts(agenda());
    expect(f?.sitioQuirurgico).toBe('ABDOMINAL_SUPERIOR');
    expect(f?.modalidad).toBe('HOSPITALIZACION');
  });

  it('sin agenda devuelve null y los hechos px quedan vacíos', () => {
    expect(scheduleToFacts(null)).toBeNull();
    expect(facts(null)['px.disponible']).toBe(false);
    expect(facts(null)['px.sitio_quirurgico']).toBeNull();
  });
});
