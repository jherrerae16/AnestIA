import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Invariante NO negociable: la nota privada del médico NUNCA entra al documento clínico ni a
 * la distribución (no es historia clínica oficial; es la libreta privada). Este test lo fija
 * a nivel de código: si alguien hiciera que el renderer del PDF o la distribución leyeran las
 * notas, aquí saltaría. La separación se mantiene por construcción, no por buena voluntad.
 */
describe('separación de las notas privadas del documento clínico', () => {
  const files = [
    'services/document.service.ts',
    'services/distribution.service.ts',
    'pdf/renderer.ts',
  ];

  for (const rel of files) {
    it(`${rel} no referencia PatientNote ni note.service`, () => {
      const src = readFileSync(join(__dirname, '..', rel), 'utf8');
      expect(src).not.toMatch(/PatientNote|patientNote|note\.service/);
    });
  }
});
