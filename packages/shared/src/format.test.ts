import { describe, it, expect } from 'vitest';
import { formatDocumentId } from './format';

describe('formatDocumentId', () => {
  it('cédula: puntos de miles estilo Colombia', () => {
    expect(formatDocumentId('1042246578')).toBe('1.042.246.578');
    expect(formatDocumentId('72345381')).toBe('72.345.381');
    expect(formatDocumentId('900')).toBe('900');
  });
  it('re-formatea si ya venía con puntos', () => {
    expect(formatDocumentId('1.042.246.578')).toBe('1.042.246.578');
  });
  it('pasaporte: sin puntos, en mayúsculas', () => {
    expect(formatDocumentId('pe19028')).toBe('PE19028');
    expect(formatDocumentId('AB-123456')).toBe('AB-123456');
  });
  it('vacío → cadena vacía', () => {
    expect(formatDocumentId('')).toBe('');
    expect(formatDocumentId(null)).toBe('');
  });
});
