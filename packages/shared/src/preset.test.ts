import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isVisible } from './preset';
import { validateAnswers, formAnswersSchema } from './form';
import type { QuestionDef } from './preset';

describe('isVisible — motor condicional (PBT invariant)', () => {
  it('sin condicional → siempre visible', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.record({ value: fc.string() })), (answers) => {
        expect(isVisible({ conditional: null }, answers as never)).toBe(true);
      }),
    );
  });

  it('showIf → visible sólo si la dependencia coincide (example)', () => {
    const q = { conditional: { showIf: { questionOrder: 20, equals: 'si' } } };
    expect(isVisible(q, { 20: { value: 'sí' } } as never)).toBe(true);  // acentos normalizados
    expect(isVisible(q, { 20: { value: 'Si' } } as never)).toBe(true);
    expect(isVisible(q, { 20: { value: 'no' } } as never)).toBe(false);
    expect(isVisible(q, {} as never)).toBe(false);
  });
});

describe('validateAnswers — obligatorias + condicionales (PBT invariant)', () => {
  const q20: QuestionDef = { order: 20, label: '¿Fuma?', type: 'SI_NO', required: false };
  const q21: QuestionDef = {
    order: 21, label: 'Cigarrillos/día', type: 'NUMERO', required: true,
    conditional: { showIf: { questionOrder: 20, equals: 'si' } },
  };

  it('INVARIANTE: una pregunta oculta nunca genera error de obligatoria', () => {
    fc.assert(
      fc.property(fc.constantFrom('no', 'No', 'NO', ''), (fuma) => {
        // P20 != 'si' → P21 oculta → aunque sea required y esté vacía, no debe fallar
        const errors = validateAnswers([q20, q21], { 20: { value: fuma } } as never);
        expect(errors).toEqual([]);
      }),
    );
  });

  it('P21 visible y vacía → error (example)', () => {
    const errors = validateAnswers([q20, q21], { 20: { value: 'si' } } as never);
    expect(errors.length).toBe(1);
  });

  it('P21 visible y con valor → sin error (example)', () => {
    const errors = validateAnswers([q20, q21], { 20: { value: 'si' }, 21: { value: 10 } } as never);
    expect(errors).toEqual([]);
  });
});

describe('formAnswersSchema — round-trip (PBT-02)', () => {
  it('parse preserva un mapa de respuestas válido', () => {
    const arb = fc.dictionary(
      fc.integer({ min: 1, max: 22 }).map(String),
      fc.record({
        value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        type: fc.constantFrom('TEXTO_CORTO', 'NUMERO', 'SI_NO', 'SELECCION_UNICA'),
      }),
    );
    fc.assert(
      fc.property(arb, (answers) => {
        const parsed = formAnswersSchema.parse(answers);
        expect(parsed).toEqual(answers);
      }),
    );
  });
});
