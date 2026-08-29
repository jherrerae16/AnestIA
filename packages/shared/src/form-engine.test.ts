import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  buildScreens,
  summaryRows,
  puedeEnviar,
  progreso,
  visibleQuestions,
  MAX_POR_PANTALLA,
} from './form-engine';
import { QUESTION_DICTIONARY, CODES } from './dictionary';
import { buildFacts } from './facts';
import type { QuestionDef } from './preset';
import type { FormAnswers } from './form';

/** El diccionario real como `QuestionDef[]` — lo mismo que llega desde la BD. */
const DICT: QuestionDef[] = QUESTION_DICTIONARY.map((q) => ({
  code: q.code,
  order: q.order,
  label: q.label,
  type: q.type,
  required: q.obligacion === 'O',
  obligacion: q.obligacion,
  seccion: q.seccion,
  grupo: q.grupo ?? null,
  modulo: q.modulo ?? null,
  ayuda: q.ayuda ?? null,
  alimenta: [...(q.alimenta ?? [])],
  options: q.opciones ? [...q.opciones] : null,
  conditional: q.activacion ?? null,
}));

/** Sólo lo que se le muestra al paciente (la agenda se filtra en el servidor). */
const DEL_PACIENTE = DICT.filter((q) => {
  const src = QUESTION_DICTIONARY.find((d) => d.code === q.code)!;
  return src.fuente === 'P';
});

const adulto = (extra: FormAnswers = {}): FormAnswers => ({
  [CODES.fechaNacimiento]: { value: '1985-03-12', type: 'FECHA' },
  ...extra,
});
const factsDe = (a: FormAnswers) => buildFacts({ answers: a, refDateISO: '2026-10-15' });

describe('buildScreens', () => {
  it('ninguna pantalla excede el máximo de preguntas', () => {
    const a = adulto();
    for (const s of buildScreens(DEL_PACIENTE, a, factsDe(a))) {
      expect(s.questions.length).toBeLessThanOrEqual(MAX_POR_PANTALLA);
    }
  });

  it('un acordeón de antecedentes ocupa su propia pantalla', () => {
    const a = adulto({ [CODES.tieneEnfermedad]: { value: 'si', type: 'SI_NO_NOSABE' } });
    const screens = buildScreens(DEL_PACIENTE, a, factsDe(a));
    const conAcordeon = screens.filter((s) => s.questions.some((q) => q.type === 'ACORDEON_MULTIPLE'));
    expect(conAcordeon.length).toBe(11);
    for (const s of conAcordeon) expect(s.questions).toHaveLength(1);
  });

  it('agrupa los ítems de un mismo módulo en pantallas cortas', () => {
    // STOP-Bang son varias preguntas del mismo módulo: deben compartir pantalla, no ir sueltas.
    const a = adulto();
    const screens = buildScreens(DEL_PACIENTE, a, factsDe(a));
    const stopBang = screens.filter((s) => s.modulo === 'stop_bang');
    expect(stopBang.length).toBeGreaterThan(0);
    expect(stopBang.some((s) => s.questions.length > 1)).toBe(true);
  });

  it('una pregunta que abre ramas va sola en su pantalla', () => {
    // Responder una compuerta cambia lo que hay alrededor. Compartir pantalla haría que
    // aparecieran y desaparecieran preguntas bajo el dedo del paciente.
    const a = adulto();
    const screens = buildScreens(DEL_PACIENTE, a, factsDe(a));
    for (const code of [CODES.tieneEnfermedad, CODES.tomaMedicamentos, CODES.esAlergico]) {
      const s = screens.find((x) => x.questions.some((q) => q.code === code));
      expect(s?.questions, `${code} debería ir solo`).toHaveLength(1);
    }
  });

  it('agrupa los datos de identificación en vez de una pantalla por dato', () => {
    // Doce pantallas para nombre, documento, fecha… cumple la letra de la spec y maltrata
    // al paciente.
    const a = adulto();
    const ident = buildScreens(DEL_PACIENTE, a, factsDe(a)).filter((s) => s.seccion === 'identificacion');
    expect(ident.length).toBeLessThan(8);
    expect(ident.some((s) => s.questions.length > 1)).toBe(true);
  });

  it('cubre exactamente las preguntas visibles, sin perder ni duplicar ninguna', () => {
    const a = adulto();
    const f = factsDe(a);
    const vis = visibleQuestions(DEL_PACIENTE, a, f).map((q) => q.code);
    const enPantallas = buildScreens(DEL_PACIENTE, a, f).flatMap((s) => s.questions.map((q) => q.code));
    expect(enPantallas).toEqual(vis);
    expect(new Set(enPantallas).size).toBe(enPantallas.length);
  });

  it('no muestra ninguna pantalla vacía', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('1985-03-12', '2018-01-01', '1950-01-01'),
        (nacimiento) => {
          const a = adulto({ [CODES.fechaNacimiento]: { value: nacimiento, type: 'FECHA' } });
          for (const s of buildScreens(DEL_PACIENTE, a, factsDe(a))) {
            expect(s.questions.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it('el paciente pediátrico recorre pantallas distintas del adulto', () => {
    const nino = adulto({ [CODES.fechaNacimiento]: { value: '2018-01-01', type: 'FECHA' } });
    const mayor = adulto({ [CODES.fechaNacimiento]: { value: '1950-01-01', type: 'FECHA' } });
    const secNino = new Set(buildScreens(DEL_PACIENTE, nino, factsDe(nino)).map((s) => s.seccion));
    const secMayor = new Set(buildScreens(DEL_PACIENTE, mayor, factsDe(mayor)).map((s) => s.seccion));
    expect(secNino.has('pediatrico')).toBe(true);
    expect(secNino.has('capacidad_funcional')).toBe(false);
    expect(secMayor.has('fragilidad')).toBe(true);
    expect(secMayor.has('pediatrico')).toBe(false);
  });
});

describe('summaryRows — sólo faltantes o inconsistentes', () => {
  it('no lista las preguntas ya respondidas', () => {
    const a = adulto({
      [CODES.nombre]: { value: 'Ana Pérez', type: 'TEXTO_CORTO' },
    });
    const rows = summaryRows(DEL_PACIENTE, a, factsDe(a));
    expect(rows.some((r) => r.code === CODES.nombre)).toBe(false);
    expect(rows.some((r) => r.code === CODES.documento)).toBe(true); // esa sí falta
  });

  it('marca "No sabe" como fila informativa que NO impide enviar', () => {
    const a = adulto({ [CODES.transfusionPrevia]: { value: 'no_sabe', type: 'SI_NO_NOSABE' } });
    const rows = summaryRows(DEL_PACIENTE, a, factsDe(a));
    const fila = rows.find((r) => r.code === CODES.transfusionPrevia);
    expect(fila?.motivo).toBe('no_sabe');
    // Y no es lo que bloquea: lo que bloquea son los faltantes.
    expect(puedeEnviar([fila!])).toBe(true);
  });

  it('detecta "Ninguna" marcada junto con otra opción', () => {
    const a = adulto({
      AG01: { value: ['Ninguna de las anteriores', 'Arritmia'], type: 'ACORDEON_MULTIPLE' },
      [CODES.tieneEnfermedad]: { value: 'si', type: 'SI_NO_NOSABE' },
    });
    const fila = summaryRows(DEL_PACIENTE, a, factsDe(a)).find((r) => r.code === 'AG01');
    expect(fila?.motivo).toBe('inconsistente');
    expect(puedeEnviar([fila!])).toBe(false);
  });

  it('una pregunta oculta nunca aparece como faltante', () => {
    // AL02 sólo existe si AL01 = sí. Negando, no puede pedirse.
    const a = adulto({ [CODES.esAlergico]: { value: 'no', type: 'SI_NO_NOSABE' } });
    const rows = summaryRows(DEL_PACIENTE, a, factsDe(a));
    expect(rows.some((r) => r.code === CODES.aQueEsAlergico)).toBe(false);
  });
});

describe('progreso', () => {
  it('sin responder nada es 0 y con todo lo obligatorio es 100', () => {
    const a = adulto();
    const f = factsDe(a);
    expect(progreso(DEL_PACIENTE, a, f).pct).toBeGreaterThanOrEqual(0);

    const completo: FormAnswers = { ...a };
    for (const q of visibleQuestions(DEL_PACIENTE, a, f)) {
      if (q.required) completo[q.code] = { value: 'x', type: q.type };
    }
    const p = progreso(DEL_PACIENTE, completo, factsDe(completo));
    expect(p.respondidas).toBe(p.total);
    expect(p.pct).toBe(100);
  });

  it('nunca pasa de 100 ni baja de 0', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom(...DEL_PACIENTE.map((q) => q.code)),
          fc.constantFrom('si', 'no', 'no_sabe', '').map((value) => ({ value, type: 'TEXTO_CORTO' })),
        ),
        (extra) => {
          const a = adulto(extra as FormAnswers);
          const p = progreso(DEL_PACIENTE, a, factsDe(a));
          expect(p.pct).toBeGreaterThanOrEqual(0);
          expect(p.pct).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 100 },
    );
  });
});
