import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildDocumentHtml, buildFooterTemplate, escapeHtml, toTitleCase, type Branding } from './pdf-template';
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
    expect(html).toContain('Antecedentes y medicación');
    expect(html).toContain('Examen físico');
    expect(html).toContain('Dr. Jorge A. Luquetta');
  });
});

describe('paraclínicos — seccionados por tipo de estudio', () => {
  const doc: DocumentJSON = {
    ...docWithExam(true),
    paraclinicos: {
      hemograma: { valor: 'Hemoglobina 15.9 g/dL. Dentro de los rangos reportados.', estado: 'ok', fuente: 'lab' },
      coagulacion: { valor: 'INR 0.97. Dentro de los rangos reportados.', estado: 'ok', fuente: 'lab' },
    },
  };

  it('el nombre del estudio va en Sentence case con tilde', () => {
    const html = buildDocumentHtml(doc, branding);
    expect(html).toContain('>Hemograma<');
    expect(html).toContain('>Coagulación<');
  });

  it('documentos antiguos (una clave por analito) siguen renderizando', () => {
    const viejo: DocumentJSON = {
      ...docWithExam(true),
      paraclinicos: { grupo_sanguineo: { valor: 'O+', estado: 'ok', fuente: 'lab' } },
    };
    expect(buildDocumentHtml(viejo, branding)).toContain('Grupo sanguineo');
  });
});

describe('buildFooterTemplate', () => {
  it('el pie NO va en el body: lo pinta el margin box de Chromium en cada página', () => {
    expect(buildDocumentHtml(docWithExam(true), branding)).not.toContain('<footer');
  });

  it('lleva el texto del perfil y la fecha, escapados', () => {
    const html = buildFooterTemplate({ ...branding, footer: 'Clínica <Portoazul>' }, { fechaValoracion: '16-07-2026' });
    expect(html).toContain('Clínica &lt;Portoazul&gt;');
    expect(html).toContain('16-07-2026');
  });
});

describe('toTitleCase — nombres propios', () => {
  it('capitaliza minúsculas', () => {
    expect(toTitleCase('maria elena gomez')).toBe('Maria Elena Gomez');
  });
  it('corrige MAYÚSCULAS', () => {
    expect(toTitleCase('ROBERTO MARIO URIBE')).toBe('Roberto Mario Uribe');
  });
  it('respeta partículas de/la/y salvo al inicio', () => {
    expect(toTitleCase('juan de la cruz y gómez')).toBe('Juan de la Cruz y Gómez');
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
