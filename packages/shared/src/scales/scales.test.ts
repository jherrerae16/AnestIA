import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  evaluarTodas, evaluarSTOPBang, evaluarApfel, evaluarFRAIL, evaluarARISCAT,
  evaluarRCRI, evaluarCaprini, evaluarDASI, evaluarPOVOC, type ContextoEscalas,
} from './evaluadores';
import { CORTES, categoriaDe, escalasSinValidar } from './cutpoints';
import { fuenteAdmisible, violaCS9 } from './resolve';
import { SCALE_KEYS, aSnapshot, aSnapshots, type ScaleResult } from './types';
import { buildFacts } from '../facts';
import { scheduleToFacts } from '../schedule';
import { CODES, CODIGOS_DASI } from '../dictionary/codes';
import type { FormAnswers } from '../form';

const agenda = scheduleToFacts({
  procedimiento: 'Lobectomía', fechaHora: '2026-10-15', especialidad: 'CARDIOVASCULAR',
  modalidad: 'HOSPITALIZACION', prioridad: 'ELECTIVA', sitioQuirurgico: 'INTRATORACICO',
  duracionEstimada: 'MAYOR_3H', altoRiesgoRcri: true, anestesiaProbable: 'GENERAL',
  opioidesPostop: true,
});

function ctx(answers: FormAnswers, over: Partial<ContextoEscalas> = {}): ContextoEscalas {
  return {
    answers,
    facts: buildFacts({ answers, schedule: agenda, refDateISO: '2026-10-15' }),
    ...over,
  };
}

const adulto: FormAnswers = {
  [CODES.fechaNacimiento]: { value: '1975-06-01', type: 'FECHA' },
  [CODES.sexoNacimiento]: { value: 'Hombre', type: 'SELECCION_UNICA' },
  [CODES.peso]: { value: '95', type: 'NUMERO' },
  [CODES.talla]: { value: '170', type: 'NUMERO' },
};

// ── Las invariantes que importan ─────────────────────────────────────────────────────────

describe('invariantes de las ocho escalas', () => {
  it('CALCULADA implica que no falta ninguna variable', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom(CODES.roncaFuerte, CODES.cansancioDiurno, CODES.pausasRespiratorias,
            CODES.fatiga, CODES.resistencia, CODES.ambulacion, CODES.nvpoPrevio, CODES.cinetosis),
          fc.constantFrom('si', 'no', 'no_sabe').map((v) => ({ value: v, type: 'SI_NO_NOSABE' as const })),
        ),
        (extra) => {
          for (const r of evaluarTodas(ctx({ ...adulto, ...extra } as FormAnswers))) {
            if (r.estado === 'CALCULADA') {
              expect(r.faltantes, `${r.escala} calculada con faltantes`).toEqual([]);
              expect(r.puntaje).not.toBeNull();
            }
            if (r.faltantes.length > 0) expect(r.estado).not.toBe('CALCULADA');
            if (r.puntaje != null) expect(r.estado).toBe('CALCULADA');
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('nunca emite categoría mientras los cortes no estén validados', () => {
    // Es la promesa hecha al Dr.: el puntaje se publica, la interpretación se retiene hasta
    // que el Manual Clínico exista y él la firme.
    expect(escalasSinValidar().length).toBe(SCALE_KEYS.length);
    for (const r of evaluarTodas(ctx(adulto))) expect(r.categoria).toBeNull();
    for (const k of SCALE_KEYS) expect(categoriaDe(k, 3)).toBeNull();
  });

  it('cada resultado conserva versión del instrumento y las variables que lo sustentan', () => {
    for (const r of evaluarTodas(ctx(adulto))) {
      expect(r.version).toMatch(/@\d+$/);
      if (r.estado === 'CALCULADA') {
        expect(r.cortesVersion).not.toBeNull();
        expect(r.variables.length).toBeGreaterThan(0);
        for (const v of r.variables) expect(v.fuente).toBeTruthy();
      }
    }
  });

  it('toda variable usada proviene de la lista blanca de fuentes (CS9)', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom(...CODIGOS_DASI, CODES.roncaFuerte, CODES.tvpPrevia, CODES.insulina),
          fc.constantFrom('si', 'no', 'Sí', 'No sabe').map((v) => ({ value: v, type: 'SI_NO_NOSABE' as const })),
        ),
        (extra) => {
          for (const r of evaluarTodas(ctx({ ...adulto, ...extra } as FormAnswers))) {
            for (const v of r.variables) {
              expect(fuenteAdmisible(v.fuente), `${r.escala}/${v.nombre}: ${v.fuente}`).toBe(true);
              expect(violaCS9(v)).toBeNull();
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  });
});

// ── CS9: la SpO2 no se infiere ───────────────────────────────────────────────────────────

describe('CS9 — ninguna variable de escala sale de un dato no medido', () => {
  it('rechaza una SpO2 derivada por el sistema', () => {
    expect(violaCS9({ nombre: 'SpO2', origen: 'spo2', valor: 96, fuente: 'derivado:IA' })).toMatch(/no admisible/);
    expect(violaCS9({ nombre: 'SpO2', origen: 'spo2', valor: 96, fuente: 'sistema:estimado-ia' })).toMatch(/no admisible/);
  });

  it('exige que la SpO2 la mida el anestesiólogo, aunque la fuente sea admisible', () => {
    // `formulario:` está en la lista blanca, pero la SpO2 no la puede aportar el paciente.
    expect(violaCS9({ nombre: 'SpO2', origen: 'spo2', valor: 96, fuente: 'formulario:XX01' }))
      .toMatch(/debe medirla el anestesiólogo/);
    expect(violaCS9({ nombre: 'SpO2', origen: 'anestesiologo:spo2', valor: 96, fuente: 'anestesiologo:medicion' }))
      .toBeNull();
  });

  it('ARISCAT queda PENDIENTE sin SpO2 medida, jamás la asume', () => {
    const r = evaluarARISCAT(ctx(adulto, { labs: { hemoglobina: 14 } }));
    expect(r.estado).toBe('PENDIENTE');
    expect(r.faltantes.join()).toMatch(/SpO2/);
    expect(r.puntaje).toBeNull();
  });

  it('con SpO2 medida y hemoglobina validada, ARISCAT calcula', () => {
    const answers: FormAnswers = {
      ...adulto,
      [CODES.infeccionRespiratoria]: { value: 'No', type: 'SELECCION_UNICA' },
    };
    const r = evaluarARISCAT(ctx(answers, { labs: { hemoglobina: 14 }, spo2: 97 }));
    expect(r.estado).toBe('CALCULADA');
    // Edad 51 (3) + SpO2 97 (0) + sin infección (0) + Hb 14 (0) + intratorácico (24) + >3 h (23)
    expect(r.puntaje).toBe(50);
    expect(r.variables.find((v) => v.nombre === 'SpO2 preoperatoria')?.fuente)
      .toBe('anestesiologo:medicion');
  });
});

// ── CS10: "No sabe" no es "no" ───────────────────────────────────────────────────────────

describe('CS10 — "No sabe" deja pendiente, no puntúa como negativo', () => {
  const base: FormAnswers = {
    ...adulto,
    [CODES.roncaFuerte]: { value: 'si', type: 'SI_NO_NOSABE' },
    [CODES.cansancioDiurno]: { value: 'no', type: 'SI_NO_NOSABE' },
    [CODES.pausasRespiratorias]: { value: 'no', type: 'SI_NO_NOSABE' },
    AG01: { value: ['Ninguna de las anteriores'], type: 'ACORDEON_MULTIPLE' },
    [CODES.cuello]: { value: '38', type: 'NUMERO' },
  };

  it('con todo respondido, STOP-Bang calcula', () => {
    const r = evaluarSTOPBang(ctx(base));
    expect(r.estado).toBe('CALCULADA');
  });

  it('un "no sabe" deja la escala pendiente en vez de contarlo como no', () => {
    const conNoSabe = { ...base, [CODES.pausasRespiratorias]: { value: 'no_sabe', type: 'SI_NO_NOSABE' as const } };
    const r = evaluarSTOPBang(ctx(conNoSabe));
    expect(r.estado).toBe('PENDIENTE');
    expect(r.faltantes).toContain('Pausas observadas (O)');
    // Y no se cuela un puntaje parcial que parezca completo.
    expect(r.puntaje).toBeNull();
  });

  it('un "no sabe" y un "no" no producen el mismo resultado', () => {
    const conNo = evaluarSTOPBang(ctx(base));
    const conNoSabe = evaluarSTOPBang(ctx({ ...base, [CODES.pausasRespiratorias]: { value: 'no_sabe', type: 'SI_NO_NOSABE' } }));
    expect(conNo.estado).not.toBe(conNoSabe.estado);
  });
});

// ── Activación: cada escala se abre cuando corresponde ───────────────────────────────────

describe('activación', () => {
  it('POVOC no aplica en adultos y Apfel no aplica en niños', () => {
    const nino: FormAnswers = { ...adulto, [CODES.fechaNacimiento]: { value: '2018-01-01', type: 'FECHA' } };
    expect(evaluarPOVOC(ctx(adulto)).estado).toBe('NO_INDICADA');
    expect(evaluarApfel(ctx(nino)).estado).toBe('NO_INDICADA');
    expect(evaluarApfel(ctx(nino)).motivo).toMatch(/POVOC/);
  });

  it('FRAIL no se indica en un adulto joven sin disparadores', () => {
    const joven: FormAnswers = { ...adulto, [CODES.fechaNacimiento]: { value: '1995-01-01', type: 'FECHA' } };
    expect(evaluarFRAIL(ctx(joven)).estado).toBe('NO_INDICADA');
  });

  it('FRAIL se indica a partir de los 65', () => {
    const mayor: FormAnswers = { ...adulto, [CODES.fechaNacimiento]: { value: '1950-01-01', type: 'FECHA' } };
    expect(evaluarFRAIL(ctx(mayor)).estado).not.toBe('NO_INDICADA');
  });

  it('Caprini no se indica si el módulo tromboembólico no se abrió', () => {
    expect(evaluarCaprini(ctx(adulto)).estado).toBe('NO_INDICADA');
  });

  it('el DASI no se indica si el tamizaje funcional no lo abrió', () => {
    expect(evaluarDASI(ctx(adulto)).estado).toBe('NO_INDICADA');
  });

  it('Apfel queda pendiente del plan anestésico si aún no está definido', () => {
    const sinPlan = buildFacts({
      answers: adulto,
      schedule: scheduleToFacts({ procedimiento: 'X', anestesiaProbable: 'POR_DEFINIR' }),
      refDateISO: '2026-10-15',
    });
    const r = evaluarApfel({ answers: adulto, facts: sinPlan });
    expect(r.estado).toBe('PENDIENTE');
    expect(r.faltantes.join()).toMatch(/plan anestésico/);
  });
});

// ── Reglas propias de cada instrumento ───────────────────────────────────────────────────

describe('reglas específicas', () => {
  it('Apfel cuenta NVPO y cinetosis como UN solo factor', () => {
    const answers: FormAnswers = {
      ...adulto,
      [CODES.sexoNacimiento]: { value: 'Mujer', type: 'SELECCION_UNICA' },
      [CODES.tabaco]: { value: 'Nunca', type: 'SELECCION_UNICA' },
      [CODES.nvpoPrevio]: { value: 'si', type: 'SI_NO_NOSABE' },
      [CODES.cinetosis]: { value: 'si', type: 'SI_NO_NOSABE' },
    };
    const r = evaluarApfel(ctx(answers));
    expect(r.estado).toBe('CALCULADA');
    // Mujer (1) + no fumadora (1) + NVPO/cinetosis como uno (1) + opioides (1) = 4, no 5.
    expect(r.puntaje).toBe(4);
    expect(r.variables.filter((v) => v.nombre.includes('NVPO'))).toHaveLength(1);
  });

  it('el DASI no confunde "no la realiza, pero podría" con incapacidad', () => {
    const base: Record<string, { value: string; type: 'SELECCION_UNICA' }> = {};
    for (const c of CODIGOS_DASI) base[c] = { value: 'Sí', type: 'SELECCION_UNICA' };
    const todoSi = evaluarDASI(ctx({ ...adulto, ...base } as FormAnswers));

    const conPodria = { ...base, D12: { value: 'No la realiza, pero considera que podría', type: 'SELECCION_UNICA' as const } };
    const conPodriaR = evaluarDASI(ctx({ ...adulto, ...conPodria } as FormAnswers));
    expect(conPodriaR.puntaje).toBe(todoSi.puntaje);

    const conNo = { ...base, D12: { value: 'No por limitación física', type: 'SELECCION_UNICA' as const } };
    const conNoR = evaluarDASI(ctx({ ...adulto, ...conNo } as FormAnswers));
    expect(conNoR.puntaje).toBeLessThan(todoSi.puntaje!);
  });

  it('RCRI no le pide la creatinina al paciente: la espera del laboratorio', () => {
    const answers: FormAnswers = {
      ...adulto,
      AG01: { value: ['Ninguna de las anteriores'], type: 'ACORDEON_MULTIPLE' },
      [CODES.insulina]: { value: 'no', type: 'SI_NO_NOSABE' },
    };
    const sinLab = evaluarRCRI(ctx(answers));
    expect(sinLab.estado).toBe('PENDIENTE');
    expect(sinLab.faltantes.join()).toMatch(/Creatinina/);

    const conLab = evaluarRCRI(ctx(answers, { labs: { creatinina: 1.1 } }));
    expect(conLab.estado).toBe('CALCULADA');
    expect(conLab.variables.find((v) => v.nombre.startsWith('Creatinina'))?.fuente).toBe('lab:creatinina');
  });
});

describe('tabla de cortes', () => {
  it('las ocho escalas tienen cortes con fuente bibliográfica', () => {
    for (const k of SCALE_KEYS) {
      expect(CORTES[k].bandas.length).toBeGreaterThan(0);
      expect(CORTES[k].fuente).toBeTruthy();
      expect(CORTES[k].version).toMatch(/@\d+$/);
    }
  });

  it('advierte sobre las que tienen versiones o licencia en disputa', () => {
    expect(CORTES.CAPRINI.nota).toMatch(/2005|2010|2013/);
    expect(CORTES.STOP_BANG.nota).toMatch(/permiso|comercial/i);
    expect(CORTES.DASI.nota).toMatch(/licenciado|derechos/i);
  });
});

describe('POVOC — cirugía de estrabismo', () => {
  const nino: FormAnswers = {
    [CODES.fechaNacimiento]: { value: '2018-01-01', type: 'FECHA' },
    [CODES.vomitoPrevio]: { value: 'Ninguno', type: 'SELECCION_UNICA' },
  };
  const agendaPed = scheduleToFacts({
    procedimiento: 'Cirugía de estrabismo', fechaHora: '2026-10-15',
    especialidad: 'OFTALMOLOGIA', modalidad: 'AMBULATORIA', prioridad: 'ELECTIVA',
    sitioQuirurgico: 'PERIFERICO', duracionEstimada: 'ENTRE_2_Y_3H',
    altoRiesgoRcri: false, anestesiaProbable: 'GENERAL', opioidesPostop: false,
  });
  const ctxPed = (proc: string) => ({
    answers: nino,
    facts: buildFacts({ answers: nino, schedule: agendaPed, refDateISO: '2026-10-15' }),
    procedimiento: proc,
  });

  it('reconoce el estrabismo por el NOMBRE del procedimiento', () => {
    // Antes se comparaba la especialidad contra 'oftalmologia', un valor que ni existía en el
    // enum: el factor no puntuaba nunca y nada fallaba a la vista.
    const r = evaluarPOVOC(ctxPed('Cirugía de estrabismo'));
    expect(r.estado).toBe('CALCULADA');
    const v = r.variables.find((x) => x.nombre === 'Cirugía de estrabismo');
    expect(v?.valor).toBe(true);
    expect(v?.puntos).toBe(1);
  });

  it('no lo cuenta en otra cirugía oftalmológica', () => {
    const r = evaluarPOVOC(ctxPed('Facoemulsificación'));
    expect(r.variables.find((x) => x.nombre === 'Cirugía de estrabismo')?.valor).toBe(false);
  });

  it('queda pendiente si no se conoce el procedimiento', () => {
    const r = evaluarPOVOC({ ...ctxPed(''), procedimiento: null });
    expect(r.estado).toBe('PENDIENTE');
  });
});

describe('proyección al documento', () => {
  const fila = {
    escala: 'ARISCAT', version: 'ARISCAT@1', cortesVersion: null,
    estado: 'REVISION_CLINICA', puntaje: null, categoria: null, variables: [],
    faltantes: [], motivo: 'Discordancia.', resueltoPor: 'anest-1',
    resueltoAt: new Date('2026-08-30T10:00:00.000Z'),
  };

  it('conserva la resolución de una revisión clínica', () => {
    // Estaba duplicada en el motor clínico y en la revisión, y se separaron: uno incluía la
    // resolución y el otro no, así que la escala seguía bloqueando aunque el médico la hubiera
    // resuelto. Una sola función para los dos.
    const s = aSnapshot(fila);
    expect(s.resueltoPor).toBe('anest-1');
    expect(s.resueltoAt).toBe('2026-08-30T10:00:00.000Z');
  });

  it('traduce el nombre de la escala', () => {
    expect(aSnapshot(fila).nombre).toBe('ARISCAT — riesgo pulmonar');
  });

  it('acepta la fecha ya serializada', () => {
    expect(aSnapshot({ ...fila, resueltoAt: '2026-08-30T10:00:00.000Z' }).resueltoAt)
      .toBe('2026-08-30T10:00:00.000Z');
  });

  it('omite del documento las escalas no indicadas, pero no las demás', () => {
    const filas = [fila, { ...fila, escala: 'POVOC', estado: 'NO_INDICADA' }];
    const out = aSnapshots(filas);
    expect(out).toHaveLength(1);
    expect(out[0]!.escala).toBe('ARISCAT');
  });

  it('sin resolución deja los campos en null, no undefined', () => {
    const s = aSnapshot({ ...fila, resueltoPor: null, resueltoAt: null });
    expect(s.resueltoPor).toBeNull();
    expect(s.resueltoAt).toBeNull();
  });
});
