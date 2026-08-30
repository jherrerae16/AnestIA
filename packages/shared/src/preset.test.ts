import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isVisible, type QuestionDef } from './preset';
import { validateAnswers, formAnswersSchema } from './form';

/** Pregunta mínima válida, para no repetir los campos por defecto en cada caso. */
function q(partial: Partial<QuestionDef> & Pick<QuestionDef, 'code' | 'order' | 'label' | 'type'>): QuestionDef {
  return { required: false, obligacion: 'C', alimenta: [], ...partial };
}

describe('isVisible — motor de reglas (PBT invariant)', () => {
  it('sin regla → siempre visible', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.record({ value: fc.string() })), (answers) => {
        expect(isVisible({ conditional: null }, answers as never)).toBe(true);
      }),
    );
  });

  it('regla de igualdad → visible sólo si la dependencia coincide', () => {
    const dep = {
      conditional: { kind: 'answer', code: 'HB01', op: 'equals', value: 'si' },
    } as const;
    expect(isVisible(dep, { HB01: { value: 'sí' } })).toBe(true); // acentos normalizados
    expect(isVisible(dep, { HB01: { value: 'Si' } })).toBe(true);
    expect(isVisible(dep, { HB01: { value: 'no' } })).toBe(false);
    expect(isVisible(dep, {})).toBe(false);
  });

  it('una regla puede componerse sobre hechos derivados, no sólo sobre respuestas', () => {
    const soloAdultos: Pick<QuestionDef, 'conditional'> = {
      conditional: { kind: 'fact', fact: 'ruta', op: 'in', value: ['ADULTO', 'ADULTO_MAYOR'] },
    };
    expect(isVisible(soloAdultos, {}, { ruta: 'ADULTO' })).toBe(true);
    expect(isVisible(soloAdultos, {}, { ruta: 'PEDIATRICA' })).toBe(false);
    // Hecho desconocido: la rama no se abre. Sin agenda no se pregunta por el procedimiento.
    expect(isVisible(soloAdultos, {}, {})).toBe(false);
  });
});

describe('validateAnswers — obligatorias, opciones y exclusividad', () => {
  const HB01 = q({ code: 'HB01', order: 1, label: '¿Fuma?', type: 'SI_NO_NOSABE',
    options: ['Sí', 'No', 'No sabe'] });
  const HB02 = q({
    code: 'HB02', order: 2, label: 'Cigarrillos por día', type: 'NUMERO', required: true,
    conditional: { kind: 'answer', code: 'HB01', op: 'equals', value: 'si' },
  });

  it('INVARIANTE: una pregunta oculta nunca genera error de obligatoria', () => {
    fc.assert(
      fc.property(fc.constantFrom('no', 'No', 'NO', 'no sabe', ''), (fuma) => {
        const errors = validateAnswers([HB01, HB02], { HB01: { value: fuma, type: 'SI_NO_NOSABE' } });
        expect(errors).toEqual([]);
      }),
    );
  });

  it('la dependiente visible y vacía produce error', () => {
    const errors = validateAnswers([HB01, HB02], { HB01: { value: 'si', type: 'SI_NO_NOSABE' } });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('HB02');
  });

  it('la dependiente visible y con valor no produce error', () => {
    const errors = validateAnswers([HB01, HB02], {
      HB01: { value: 'si', type: 'SI_NO_NOSABE' },
      HB02: { value: 10, type: 'NUMERO' },
    });
    expect(errors).toEqual([]);
  });

  it('rechaza un valor que no es de los tres estados', () => {
    const errors = validateAnswers([HB01], { HB01: { value: 'quizás', type: 'SI_NO_NOSABE' } });
    expect(errors.join()).toMatch(/valor no permitido/);
  });

  it('acepta los tres estados canónicos, sin depender de cómo esté redactada la etiqueta', () => {
    for (const v of ['si', 'no', 'no_sabe', 'Sí', 'No sabe']) {
      expect(validateAnswers([HB01], { HB01: { value: v, type: 'SI_NO_NOSABE' } })).toEqual([]);
    }
  });

  it('rechaza una opción que no pertenece al conjunto declarado', () => {
    const AG01 = q({
      code: 'AG01', order: 9, label: 'Corazón', type: 'ACORDEON_MULTIPLE',
      options: ['Arritmia', 'Ninguna de las anteriores'],
    });
    const errors = validateAnswers([AG01], { AG01: { value: ['Gripa'], type: 'ACORDEON_MULTIPLE' } });
    expect(errors.join()).toMatch(/opción no permitida/);
  });

  it('rechaza "Ninguna" marcada junto con otra opción', () => {
    const AG01 = q({
      code: 'AG01', order: 3, label: 'Corazón y circulación', type: 'ACORDEON_MULTIPLE',
      options: ['Hipertensión arterial', 'Arritmia', 'Ninguna de las anteriores'],
    });
    const errors = validateAnswers([AG01], {
      AG01: { value: ['Ninguna de las anteriores', 'Hipertensión arterial'], type: 'ACORDEON_MULTIPLE' },
    });
    expect(errors.join()).toMatch(/excluyente/);
  });

  it('acepta "Ninguna" sola', () => {
    const AG01 = q({
      code: 'AG01', order: 3, label: 'Corazón y circulación', type: 'ACORDEON_MULTIPLE',
      options: ['Hipertensión arterial', 'Ninguna de las anteriores'],
    });
    const errors = validateAnswers([AG01], {
      AG01: { value: ['Ninguna de las anteriores'], type: 'ACORDEON_MULTIPLE' },
    });
    expect(errors).toEqual([]);
  });

  it('rechaza un dato de agenda enviado desde el formulario del paciente', () => {
    const PX07 = q({
      code: 'PX07', order: 4, label: 'Sitio quirúrgico ARISCAT', type: 'SELECCION_UNICA',
      obligacion: 'S', options: ['Periférico', 'Abdominal superior', 'Intratorácico'],
    });
    const errors = validateAnswers([PX07], {
      PX07: { value: 'Periférico', type: 'SELECCION_UNICA' },
    });
    expect(errors.join()).toMatch(/dato de agenda/);
  });
});

describe('formAnswersSchema — claves por código', () => {
  it('preserva un mapa de respuestas válido', () => {
    const arb = fc.dictionary(
      fc.constantFrom('ID01', 'ID03', 'CF01', 'SB03', 'AG01', 'D07'),
      fc.record({
        value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        type: fc.constantFrom('TEXTO_CORTO', 'NUMERO', 'SI_NO_NOSABE', 'SELECCION_UNICA'),
      }),
    );
    fc.assert(
      fc.property(arb, (answers) => {
        expect(formAnswersSchema.parse(answers)).toEqual(answers);
      }),
    );
  });

  it('acepta claves de instancia de repetidor', () => {
    const parsed = formAnswersSchema.parse({
      'AP01#hipertension_arterial': { value: 'Controlada', type: 'SELECCION_UNICA' },
      'GL03#1': { value: 'Ayer', type: 'SELECCION_UNICA' },
    });
    expect(Object.keys(parsed)).toHaveLength(2);
  });

  it('rechaza la numeración posicional anterior', () => {
    expect(() =>
      formAnswersSchema.parse({ '15': { value: 'x', type: 'TEXTO_CORTO' } }),
    ).toThrow();
  });
});

describe('validateAnswers — reglas declaradas del diccionario', () => {
  const peso = q({
    code: 'ID10', order: 20, label: '¿Cuál es su peso actual?', type: 'NUMERO', required: true,
    obligacion: 'O', validacion: { min: 0.5, max: 400, unidad: 'kg' },
  });
  const doc = q({
    code: 'ID02', order: 21, label: 'Documento', type: 'DOCUMENTO_ID', required: true,
    obligacion: 'O', validacion: { patron: '^[A-Za-z0-9.\\-]{4,20}$' },
  });

  it('acepta un peso plausible', () => {
    expect(validateAnswers([peso], { ID10: { value: '62', type: 'NUMERO' } })).toEqual([]);
  });

  it('rechaza un peso fuera de rango', () => {
    const errors = validateAnswers([peso], { ID10: { value: '900', type: 'NUMERO' } });
    expect(errors.join()).toMatch(/fuera del rango/);
  });

  it('rechaza un documento que no cumple el patrón', () => {
    const errors = validateAnswers([doc], { ID02: { value: 'ANA RESTREPO', type: 'DOCUMENTO_ID' } });
    expect(errors.join()).toMatch(/formato inválido/);
  });

  it('acepta una cédula con puntos de miles', () => {
    expect(validateAnswers([doc], { ID02: { value: '1.042.246.572', type: 'DOCUMENTO_ID' } })).toEqual([]);
  });
});

describe('validateAnswers — preguntas opcionales sin responder', () => {
  it('no revienta con una pregunta opcional en blanco que declara validación', () => {
    // Regresión: al aplicar `validacion` antes de comprobar el vacío, una opcional sin
    // responder lanzaba "Cannot read properties of undefined" y tumbaba el envío entero.
    const opcional = q({
      code: 'SB07', order: 30, label: 'Circunferencia del cuello', type: 'NUMERO',
      required: false, obligacion: 'V', validacion: { min: 20, max: 80, unidad: 'cm' },
    });
    expect(() => validateAnswers([opcional], {})).not.toThrow();
    expect(validateAnswers([opcional], {})).toEqual([]);
  });
})
