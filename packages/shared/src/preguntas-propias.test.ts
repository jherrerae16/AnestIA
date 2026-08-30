import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  preguntaPropiaSchema,
  propiaAQuestionDef,
  siguienteCodigoPropio,
  validarPropias,
  ORDEN_BASE_PROPIA,
  type PreguntaPropia,
} from './preguntas-propias';
import { QUESTION_DICTIONARY } from './dictionary';

const base = (o: Partial<PreguntaPropia> = {}): unknown => ({
  code: 'PR01',
  label: '¿Quién lo acompaña el día de la cirugía?',
  type: 'TEXTO_CORTO',
  required: false,
  ...o,
});

describe('pregunta propia — el borde', () => {
  it('acepta una pregunta simple', () => {
    expect(preguntaPropiaSchema.safeParse(base()).success).toBe(true);
  });

  it('rechaza un código que no sea PR', () => {
    // El prefijo es lo que impide pisar la trazabilidad de una pregunta del Dr.
    for (const code of ['ID01', 'CF01', 'X01', 'PRA1']) {
      expect(preguntaPropiaSchema.safeParse(base({ code })).success, code).toBe(false);
    }
  });

  it('una pregunta de selección sin opciones no pasa', () => {
    const r = preguntaPropiaSchema.safeParse(base({ type: 'SELECCION_UNICA' }));
    expect(r.success).toBe(false);
  });

  it('un texto corto con opciones tampoco', () => {
    const r = preguntaPropiaSchema.safeParse(base({ type: 'TEXTO_CORTO', options: ['a', 'b'] }));
    expect(r.success).toBe(false);
  });

  it('opciones repetidas se rechazan', () => {
    const r = preguntaPropiaSchema.safeParse(
      base({ type: 'SELECCION_UNICA', options: ['Sí', 'sí'] }),
    );
    expect(r.success).toBe(false);
  });

  it('no admite los tipos que llevan semántica de la Especificación', () => {
    // Repetidor, acordeón y archivo significan cosas concretas (instancias por enfermedad,
    // "Ninguna" excluyente, adjuntos del caso) que no se pueden replicar a mano.
    for (const type of ['REPETIDOR', 'ACORDEON_MULTIPLE', 'ARCHIVO', 'ESCALA_ITEMS']) {
      expect(preguntaPropiaSchema.safeParse(base({ type: type as never })).success, type).toBe(false);
    }
  });
});

describe('validarPropias', () => {
  it('detecta un código repetido', () => {
    const qs = [base(), base()].map((q) => preguntaPropiaSchema.parse(q));
    expect(validarPropias(qs)[0]).toContain('repetido');
  });

  it('ninguna pregunta del diccionario real empieza por PR', () => {
    // La garantía del prefijo se COMPRUEBA, no se asume: si mañana el Dr. añade un módulo "PR",
    // este test falla antes de que dos preguntas distintas compartan código.
    expect(QUESTION_DICTIONARY.filter((q) => /^PR\d/.test(q.code))).toEqual([]);
  });

  it('un conjunto limpio no produce errores', () => {
    const qs = [base(), base({ code: 'PR02' })].map((q) => preguntaPropiaSchema.parse(q));
    expect(validarPropias(qs)).toEqual([]);
  });
});

describe('siguienteCodigoPropio', () => {
  it('empieza en PR01', () => {
    expect(siguienteCodigoPropio([])).toBe('PR01');
  });

  it('no reutiliza un código en uso', () => {
    expect(siguienteCodigoPropio([{ code: 'PR01' }, { code: 'PR02' }])).toBe('PR03');
  });

  it('rellena un hueco dejado por una pregunta borrada', () => {
    expect(siguienteCodigoPropio([{ code: 'PR01' }, { code: 'PR03' }])).toBe('PR02');
  });

  it('nunca devuelve un código ya usado', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: 1, max: 99 }), { maxLength: 40 }), (ns) => {
        const usados = ns.map((n) => ({ code: `PR${String(n).padStart(2, '0')}` }));
        expect(usados.map((u) => u.code)).not.toContain(siguienteCodigoPropio(usados));
      }),
      { numRuns: 200 },
    );
  });
});

describe('propiaAQuestionDef', () => {
  it('nunca alimenta una escala ni lleva regla de activación', () => {
    // Una escala se calcula con las variables que la Especificación nombra (CS9). Si una
    // pregunta propia pudiera declarar `alimenta`, el médico podría enchufar cualquier respuesta
    // a un puntaje que firma.
    const def = propiaAQuestionDef(preguntaPropiaSchema.parse(base()), 0);
    expect(def.alimenta).toEqual([]);
    expect(def.conditional).toBeNull();
  });

  it('va después de todo el diccionario', () => {
    const maxDiccionario = Math.max(...QUESTION_DICTIONARY.map((q) => q.order));
    const def = propiaAQuestionDef(preguntaPropiaSchema.parse(base()), 0);
    expect(def.order).toBeGreaterThan(maxDiccionario);
    expect(def.order).toBe(ORDEN_BASE_PROPIA);
  });

  it('es condicional aunque esté marcada como requerida', () => {
    // Una propia obligatoria bloquearía el envío del formulario por algo que no está en la
    // Especificación; el asterisco la marca, pero no traba al paciente.
    const def = propiaAQuestionDef(preguntaPropiaSchema.parse(base({ required: true })), 0);
    expect(def.obligacion).toBe('C');
    expect(def.required).toBe(true);
  });
});
