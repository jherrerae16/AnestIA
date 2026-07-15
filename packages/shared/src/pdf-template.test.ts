import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildDocumentHtml, escapeHtml, type Branding } from './pdf-template';
import type { DocumentJSON } from './document';

const branding: Branding = { doctorName: 'Dr. Jorge A. Luquetta', specialty: 'Anestesiología', registry: '123' };

function docWithExam(pending: boolean): DocumentJSON {
  return {
    identificacion: { asa: { valor: 'II', estado: 'ok', fuente: 'IA' } },
    antecedentes: {},
    paraclinicos: {},
    examen_fisico: pending
      ? { signos_vitales: { valor: null, estado: 'pendiente_examen', fuente: null } }
      : { signos_vitales: { valor: 'TA 120/80', estado: 'ok', fuente: 'anestesiologo' } },
    valoracion_plan: {},
  };
}

describe('buildDocumentHtml', () => {
  it('DETERMINISTA: mismo input → mismo HTML', () => {
    const d = docWithExam(true);
    expect(buildDocumentHtml(d, branding)).toBe(buildDocumentHtml(d, branding));
  });

  it('INVARIANTE: examen pendiente ⇒ marca de agua BORRADOR (CS3)', () => {
    const html = buildDocumentHtml(docWithExam(true), branding);
    expect(html).toContain('BORRADOR');
  });

  it('incluye secciones del Diseño Oficial + firma', () => {
    const html = buildDocumentHtml(docWithExam(true), branding);
    expect(html).toContain('VALORACIÓN PREANESTÉSICA');
    expect(html).toContain('ANTECEDENTES Y MEDICACIÓN');
    expect(html).toContain('EXAMEN FÍSICO');
    expect(html).toContain('Dr. Jorge A. Luquetta');
  });
});

describe('escapeHtml — anti-inyección (PBT)', () => {
  it('nunca deja pasar < o > sin escapar', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = escapeHtml(s);
        expect(out.includes('<')).toBe(false);
        expect(out.includes('>')).toBe(false);
      }),
    );
  });

  it('escapa un intento de script (example)', () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
  });
});
