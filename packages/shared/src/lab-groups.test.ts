import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { groupLabsToProse, grupoLabel, normalizeGrupo, type GroupableLab } from './lab-groups';

const hemograma: GroupableLab[] = [
  { analyte: 'Hemoglobina', value: '15.9', unit: 'g/dL', grupo: 'hemograma', flag: 'NORMAL', sourceRef: 'hemograma:hb' },
  { analyte: 'Hematocrito', value: '48.2', unit: '%', grupo: 'hemograma', flag: 'NORMAL', sourceRef: 'hemograma:hto' },
];

describe('normalizeGrupo', () => {
  it('acepta el grupo canónico tal cual', () => {
    expect(normalizeGrupo('coagulacion')).toBe('coagulacion');
  });

  it('reconoce sinónimos del informe, con tildes y mayúsculas', () => {
    expect(normalizeGrupo('CUADRO HEMÁTICO')).toBe('hemograma');
    expect(normalizeGrupo('Pruebas de Coagulación')).toBe('coagulacion');
    expect(normalizeGrupo('PARCIAL DE ORINA')).toBe('uroanalisis');
    expect(normalizeGrupo('Química sanguínea')).toBe('bioquimica');
  });

  // Caso real del piloto: el informe titulaba la sección "endocrinología" y TSH/T4 caían
  // en otros porque el grupo no existía. El extractor leyó bien; faltaba el grupo.
  it('el perfil hormonal es su propio estudio, no inmunología', () => {
    expect(normalizeGrupo('endocrinologia')).toBe('endocrinologia');
    expect(normalizeGrupo('PERFIL TIROIDEO')).toBe('endocrinologia');
    expect(normalizeGrupo('Inmunología')).toBe('inmunologia');
  });

  it('CS2: lo desconocido o vacío cae en otros, no se adivina', () => {
    expect(normalizeGrupo('estudio raro sin nombre')).toBe('otros');
    expect(normalizeGrupo('')).toBe('otros');
    expect(normalizeGrupo(null)).toBe('otros');
  });

  it('PBT: siempre devuelve un grupo con etiqueta', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(grupoLabel(normalizeGrupo(s)).length).toBeGreaterThan(0);
      }),
    );
  });
});

describe('groupLabsToProse', () => {
  it('agrupa por estudio: una fila por grupo, no una por analito', () => {
    const out = groupLabsToProse([
      ...hemograma,
      { analyte: 'INR', value: '0.97', grupo: 'coagulacion', flag: 'NORMAL', sourceRef: 'coagulacion:inr' },
    ]);
    expect(out.map((g) => g.grupo)).toEqual(['hemograma', 'coagulacion']);
    expect(out[0]!.texto).toContain('Hemoglobina 15.9 g/dL; Hematocrito 48.2 %. Dentro de los rangos reportados.');
  });

  it('el orden de salida es estable, no depende del orden de entrada', () => {
    const a = groupLabsToProse([
      { analyte: 'INR', value: '0.97', grupo: 'coagulacion', flag: 'NORMAL' },
      ...hemograma,
    ]);
    expect(a.map((g) => g.grupo)).toEqual(['hemograma', 'coagulacion']);
  });

  it('un flag alterado marca el grupo y se enumera en la frase de cierre', () => {
    const out = groupLabsToProse([
      { analyte: 'Hemoglobina', value: '8.1', unit: 'g/dL', grupo: 'hemograma', flag: 'ALERTA' },
      { analyte: 'Plaquetas', value: '244000', unit: '/uL', grupo: 'hemograma', flag: 'NORMAL' },
    ]);
    expect(out[0]!.alerta).toBe(true);
    expect(out[0]!.texto).toContain('Alteración en: Hemoglobina (alerta)');
  });

  it('CS2: la frase de cierre sólo refleja los flags, no inventa normalidad por grupo', () => {
    const out = groupLabsToProse([{ analyte: 'Sodio', value: '140', unit: 'mmol/L', grupo: 'bioquimica', flag: 'NORMAL' }]);
    expect(out[0]!.texto).toContain('Sodio 140 mmol/L. Dentro de los rangos reportados.');
  });

  it('sin labs no hay filas', () => {
    expect(groupLabsToProse([])).toEqual([]);
  });
});

describe('groupLabsToProse — fecha del informe', () => {
  const conFecha = (fecha: string | null): GroupableLab[] => [
    { analyte: 'Hemoglobina', value: '15.9', unit: 'g/dL', grupo: 'hemograma', flag: 'NORMAL', reportDate: fecha },
  ];

  it('muestra la fecha del informe en formato del documento', () => {
    const out = groupLabsToProse(conFecha('2026-07-10'), '2026-07-16');
    expect(out[0]!.texto).toContain('Informe del 10-07-2026.');
    expect(out[0]!.fecha).toBe('2026-07-10');
    expect(out[0]!.desactualizado).toBe(false);
  });

  // El caso que motivó todo: el paciente adjunta un examen viejo y el médico no lo nota.
  it('un examen antiguo se marca como desactualizado y en alerta', () => {
    const out = groupLabsToProse(conFecha('2025-11-07'), '2026-07-16');
    expect(out[0]!.desactualizado).toBe(true);
    expect(out[0]!.alerta).toBe(true);
    expect(out[0]!.texto).toContain('verificar vigencia');
  });

  it('CS2: sin fecha en el informe se declara la ausencia, no se asume reciente', () => {
    const out = groupLabsToProse(conFecha(null), '2026-07-16');
    expect(out[0]!.fecha).toBeNull();
    expect(out[0]!.desactualizado).toBe(false);
    expect(out[0]!.texto).toContain('no reporta fecha');
  });

  it('la fecha del grupo es la del analito más antiguo', () => {
    const out = groupLabsToProse(
      [
        { analyte: 'Hemoglobina', value: '15.9', grupo: 'hemograma', flag: 'NORMAL', reportDate: '2026-07-10' },
        { analyte: 'Plaquetas', value: '244000', grupo: 'hemograma', flag: 'NORMAL', reportDate: '2025-01-05' },
      ],
      '2026-07-16',
    );
    expect(out[0]!.fecha).toBe('2025-01-05');
    expect(out[0]!.desactualizado).toBe(true);
  });

  it('conserva los sourceRef del grupo para la trazabilidad', () => {
    expect(groupLabsToProse(hemograma)[0]!.fuentes).toEqual(['hemograma:hb', 'hemograma:hto']);
  });
});
