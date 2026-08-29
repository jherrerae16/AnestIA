import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  QUESTION_DICTIONARY,
  CODIGOS_SISTEMA,
  validateDictionary,
  diffPresetVsDiccionario,
  visibilityNodes,
  preguntasDelPaciente,
  GRUPOS_PATOLOGIAS,
  OPCION_NINGUNA,
} from './index';
import { buildFacts } from '../facts';
import { evaluateRule, visibleCodes, pruneHiddenAnswers, type AnswerLike } from '../rules';

describe('diccionario — integridad estructural', () => {
  it('es válido', () => {
    expect(validateDictionary()).toEqual([]);
  });

  it('los códigos son únicos', () => {
    const codes = QUESTION_DICTIONARY.map((q) => q.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('cubre los 11 grupos de antecedentes como acordeones, no como preguntas sueltas', () => {
    const acordeones = QUESTION_DICTIONARY.filter((q) => q.type === 'ACORDEON_MULTIPLE');
    expect(acordeones).toHaveLength(GRUPOS_PATOLOGIAS.length);
    expect(acordeones).toHaveLength(11);
  });

  it('cada acordeón ofrece "Ninguna de las anteriores"', () => {
    for (const q of QUESTION_DICTIONARY.filter((x) => x.type === 'ACORDEON_MULTIPLE')) {
      expect(q.opciones).toContain(OPCION_NINGUNA);
    }
  });

  it('los 12 ítems del DASI están completos', () => {
    const dasi = QUESTION_DICTIONARY.filter((q) => q.modulo === 'dasi');
    expect(dasi).toHaveLength(12);
  });

  it('PX01-PX11 son datos de sistema y nunca se le preguntan al paciente', () => {
    const px = QUESTION_DICTIONARY.filter((q) => q.code.startsWith('PX'));
    expect(px).toHaveLength(11);
    // PX10 y PX11 los verifica el anestesiólogo; el resto son de agenda. Ninguno es del paciente.
    for (const q of px) expect(['S', 'V']).toContain(q.obligacion);
    expect(preguntasDelPaciente().some((q) => q.code.startsWith('PX') && q.obligacion === 'S')).toBe(false);
  });

  it('ningún dato de sistema aparece entre las preguntas del paciente', () => {
    const visibles = new Set(preguntasDelPaciente().map((q) => q.code));
    for (const code of CODIGOS_SISTEMA) expect(visibles.has(code)).toBe(false);
  });
});

// ── La regla que los tres documentos repiten ─────────────────────────────────────────────

describe('"No sabe" nunca equivale a "No"', () => {
  const nodes = visibilityNodes();
  const ternarias = QUESTION_DICTIONARY.filter((q) => q.type === 'SI_NO_NOSABE');

  it('hay preguntas de tres estados en el diccionario', () => {
    expect(ternarias.length).toBeGreaterThan(10);
  });

  it('responder "no sabe" nunca abre exactamente lo mismo que responder "no"', () => {
    // Para cada pregunta ternaria: el conjunto visible con 'no' y con 'no_sabe' puede coincidir
    // (si nada depende de ella), pero jamás puede ocurrir que 'no_sabe' se comporte como 'si'
    // ni que una regla trate 'no_sabe' como negación implícita. Lo verificamos comparando
    // contra 'si': si 'no_sabe' abriera lo mismo que 'si', la rama estaría colapsando estados.
    for (const q of ternarias) {
      const conValor = (v: string) => {
        const answers: Record<string, AnswerLike> = { [q.code]: { value: v } };
        return visibleCodes(nodes, { answers, facts: {} });
      };
      const si = conValor('si');
      const noSabe = conValor('no_sabe');
      const dependientes = QUESTION_DICTIONARY.filter(
        (d) => d.activacion && JSON.stringify(d.activacion).includes(`"${q.code}"`),
      );
      if (dependientes.length > 0) {
        // Alguna dependiente que se abre con 'si' NO debe abrirse con 'no sabe'.
        const abiertasConSi = dependientes.filter((d) => si.has(d.code));
        for (const d of abiertasConSi) {
          expect(
            noSabe.has(d.code),
            `${d.code} se abre igual con "si" que con "no sabe" desde ${q.code}`,
          ).toBe(false);
        }
      }
    }
  });

  it('el validador rechaza una negación sobre una pregunta de tres estados', () => {
    const errores = validateDictionary([
      {
        code: 'ZZ01', order: 1, label: 'Ternaria', type: 'SI_NO_NOSABE',
        obligacion: 'O', fuente: 'P', seccion: 'identificacion',
        opciones: ['Sí', 'No', 'No sabe'],
      },
      {
        code: 'ZZ02', order: 2, label: 'Depende con negación', type: 'TEXTO_CORTO',
        obligacion: 'C', fuente: 'P', seccion: 'identificacion',
        activacion: { kind: 'answer', code: 'ZZ01', op: 'notEquals', value: 'si' },
      },
    ]);
    expect(errores.join('\n')).toMatch(/tres estados/);
  });

  it('un campo sin responder no satisface una negación (un blanco no afirma nada)', () => {
    const rule = { kind: 'answer', code: 'AL01', op: 'notEquals', value: 'si' } as const;
    expect(evaluateRule(rule, { answers: {}, facts: {} })).toBe(false);
  });
});

// ── Rutas derivadas ──────────────────────────────────────────────────────────────────────

describe('rutas derivadas de la fecha de nacimiento', () => {
  const facts = (birth: string, ref: string) =>
    buildFacts({ answers: { ID03: { value: birth } }, refDateISO: ref });

  it('deriva las bandas etarias de la especificación', () => {
    expect(facts('2026-08-20', '2026-09-01').banda_etaria).toBe('NEONATO');
    expect(facts('2025-01-01', '2026-09-01').banda_etaria).toBe('LACTANTE');
    expect(facts('2018-01-01', '2026-09-01').banda_etaria).toBe('NINO');
    expect(facts('2010-01-01', '2026-09-01').banda_etaria).toBe('ADOLESCENTE');
    expect(facts('1990-01-01', '2026-09-01').banda_etaria).toBe('ADULTO');
    expect(facts('1970-01-01', '2026-09-01').banda_etaria).toBe('ADULTO_50');
    expect(facts('1958-01-01', '2026-09-01').banda_etaria).toBe('ADULTO_65');
    expect(facts('1945-01-01', '2026-09-01').banda_etaria).toBe('ADULTO_75');
  });

  it('un menor entra en ruta pediátrica y un mayor de 65 en adulto mayor', () => {
    expect(facts('2018-01-01', '2026-09-01').ruta).toBe('PEDIATRICA');
    expect(facts('1990-01-01', '2026-09-01').ruta).toBe('ADULTO');
    expect(facts('1950-01-01', '2026-09-01').ruta).toBe('ADULTO_MAYOR');
  });

  it('sin fecha de nacimiento no inventa una banda', () => {
    expect(buildFacts({ answers: {}, refDateISO: '2026-09-01' }).banda_etaria).toBeNull();
    expect(buildFacts({ answers: {}, refDateISO: '2026-09-01' }).ruta).toBeNull();
  });

  it('el paciente pediátrico no ve las preguntas de adulto y viceversa', () => {
    const nodes = visibilityNodes();
    const nino = visibleCodes(nodes, {
      answers: { ID03: { value: '2018-01-01' } },
      facts: facts('2018-01-01', '2026-09-01'),
    });
    const adulto = visibleCodes(nodes, {
      answers: { ID03: { value: '1990-01-01' } },
      facts: facts('1990-01-01', '2026-09-01'),
    });
    // STOP-Bang y capacidad funcional son de adultos; PD* es pediátrico.
    expect(nino.has('SB01')).toBe(false);
    expect(nino.has('CF01')).toBe(false);
    expect(nino.has('PD05')).toBe(true);
    expect(adulto.has('SB01')).toBe(true);
    expect(adulto.has('CF01')).toBe(true);
    expect(adulto.has('PD05')).toBe(false);
  });

  it('FRAIL se activa solo a partir de los 65 años', () => {
    const nodes = visibilityNodes();
    const visiblesA = (birth: string) =>
      visibleCodes(nodes, {
        answers: { ID03: { value: birth } },
        facts: facts(birth, '2026-09-01'),
      });
    expect(visiblesA('1990-01-01').has('FR01')).toBe(false);
    expect(visiblesA('1950-01-01').has('FR01')).toBe(true);
  });
});

// ── Limpieza de respuestas ocultas ───────────────────────────────────────────────────────

describe('pruneHiddenAnswers', () => {
  const nodes = visibilityNodes();

  it('borra el detalle cuando el paciente cambia su respuesta a "No"', () => {
    const answers: Record<string, AnswerLike> = {
      AL01: { value: 'si' },
      AL02: { value: ['Medicamento'] },
    };
    expect(pruneHiddenAnswers(nodes, answers, {}).AL02).toBeDefined();

    answers.AL01 = { value: 'no' };
    const limpio = pruneHiddenAnswers(nodes, answers, {});
    expect(limpio.AL02).toBeUndefined();
    expect(limpio.AL01).toBeDefined();
  });

  it('es idempotente', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom(...QUESTION_DICTIONARY.map((q) => q.code)),
          fc.oneof(
            fc.constantFrom('si', 'no', 'no_sabe'),
            fc.string({ maxLength: 12 }),
          ).map((value) => ({ value })),
        ),
        (answers) => {
          const once = pruneHiddenAnswers(nodes, answers, {});
          const twice = pruneHiddenAnswers(nodes, once, {});
          expect(twice).toEqual(once);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('el conjunto visible siempre termina, con respuestas arbitrarias', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom(...QUESTION_DICTIONARY.map((q) => q.code)),
          fc.constantFrom('si', 'no', 'no_sabe', '').map((value) => ({ value })),
        ),
        (answers) => {
          const set = visibleCodes(nodes, { answers, facts: {} });
          expect(set.size).toBeLessThanOrEqual(QUESTION_DICTIONARY.length);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── El documento se genera, no se mantiene a mano ────────────────────────────────────────

describe('docs/form-mapping.md', () => {
  it('coincide byte a byte con el diccionario', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { buildFormMappingDoc } = await import('./form-mapping');

    const ruta = join(import.meta.dirname, '../../../../docs/form-mapping.md');
    const enDisco = readFileSync(ruta, 'utf8');
    expect(
      enDisco,
      'docs/form-mapping.md quedó desincronizado. Regenéralo desde el diccionario en vez de ' +
        'editarlo a mano — es la tercera copia de la misma lista y por eso se generaba.',
    ).toBe(buildFormMappingDoc());
  });
});

describe('negaciones sobre respuestas ausentes', () => {
  it('el validador rechaza envolver una comparación de respuesta en un "not"', () => {
    const errores = validateDictionary([
      {
        code: 'ZZ01', order: 1, label: 'Padre', type: 'SELECCION_UNICA',
        obligacion: 'O', fuente: 'P', seccion: 'identificacion', opciones: ['A', 'B'],
      },
      {
        code: 'ZZ02', order: 2, label: 'Hijo', type: 'TEXTO_CORTO',
        obligacion: 'C', fuente: 'P', seccion: 'identificacion',
        activacion: { kind: 'not', rule: { kind: 'answer', code: 'ZZ01', op: 'in', value: ['A'] } },
      },
    ]);
    expect(errores.join('\n')).toMatch(/not/);
  });

  it('una rama con notIn no se abre mientras la pregunta esté sin responder', () => {
    // El bloque del acudiente (ID08) aparecía para todo el mundo por este motivo.
    const nodes = visibilityNodes();
    const adulto = buildFacts({
      answers: { ID03: { value: '1985-03-12' } },
      refDateISO: '2026-10-15',
    });
    const sinResponder = visibleCodes(nodes, { answers: { ID03: { value: '1985-03-12' } }, facts: adulto });
    expect(sinResponder.has('ID08')).toBe(false);

    const respondePaciente = visibleCodes(nodes, {
      answers: { ID03: { value: '1985-03-12' }, ID07: { value: 'Paciente' } },
      facts: adulto,
    });
    expect(respondePaciente.has('ID08')).toBe(false);

    const respondeMadre = visibleCodes(nodes, {
      answers: { ID03: { value: '1985-03-12' }, ID07: { value: 'Madre' } },
      facts: adulto,
    });
    expect(respondeMadre.has('ID08')).toBe(true);
  });
});

describe('coherencia entre lo sembrado y el diccionario', () => {
  const comoFilas = () =>
    QUESTION_DICTIONARY.map((q) => ({ code: q.code, conditional: q.activacion ?? null }));

  it('un preset materializado del diccionario no reporta diferencias', () => {
    expect(diffPresetVsDiccionario(comoFilas())).toEqual([]);
  });

  it('detecta una regla desactualizada en la base', () => {
    // Es lo que pasó al corregir la activación del DASI sin re-sembrar: el formulario siguió
    // sirviendo la regla anterior y la abría para todos.
    const filas = comoFilas();
    const dasi = filas.find((f) => f.code === 'D01')!;
    dasi.conditional = { kind: 'always' };
    expect(diffPresetVsDiccionario(filas).join()).toMatch(/D01/);
  });

  it('detecta una pregunta que sobra o que falta en la base', () => {
    expect(diffPresetVsDiccionario(comoFilas().slice(1)).join()).toMatch(/pero no en la base/);
    expect(
      diffPresetVsDiccionario([...comoFilas(), { code: 'ZZ99', conditional: null }]).join(),
    ).toMatch(/ya no en el diccionario/);
  });
});

describe('valores de hecho en las reglas', () => {
  it('el diccionario real no compara hechos contra etiquetas', () => {
    expect(validateDictionary()).toEqual([]);
  });

  it('el validador rechaza una etiqueta donde va un valor de enum', () => {
    // Pasó de verdad: la regla decía "Abdominal superior" y la agenda envía ABDOMINAL_SUPERIOR,
    // así que el DASI no se abría por sitio quirúrgico y nada fallaba a la vista.
    const errores = validateDictionary([
      {
        code: 'ZZ01', order: 1, label: 'Depende del sitio', type: 'TEXTO_CORTO',
        obligacion: 'C', fuente: 'P', seccion: 'identificacion',
        activacion: { kind: 'fact', fact: 'px.sitio_quirurgico', op: 'equals', value: 'Abdominal superior' },
      },
    ]);
    expect(errores.join('\n')).toMatch(/no es un valor válido/);
  });

  it('acepta el valor del enum', () => {
    const errores = validateDictionary([
      {
        code: 'ZZ01', order: 1, label: 'Depende del sitio', type: 'TEXTO_CORTO',
        obligacion: 'C', fuente: 'P', seccion: 'identificacion',
        activacion: { kind: 'fact', fact: 'px.sitio_quirurgico', op: 'equals', value: 'ABDOMINAL_SUPERIOR' },
      },
    ]);
    expect(errores).toEqual([]);
  });
});
