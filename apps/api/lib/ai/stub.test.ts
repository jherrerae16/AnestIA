import { describe, it, expect, afterEach, vi } from 'vitest';
import { StubAIProvider, getAIProvider } from './index';

/**
 * Guardarraíles del stub y de la selección de proveedor (Tanda 1 de la auditoría).
 * A-C1: el stub nunca fabrica labs. A-A1: fail-closed si AI_PROVIDER falta en producción.
 * A-A2: el sexo declarado por el paciente no se etiqueta como derivado de IA.
 */

/** Caso de referencia (Anexo C, Uribe): antes vivía dentro del stub; ahora es fixture de test. */
const FIXTURE_HEMOGRAMA_URIBE = [
  { analyte: 'Hemoglobina', value: '15.9', unit: 'g/dL' },
  { analyte: 'Plaquetas', value: '244000', unit: '/uL' },
];

function answer(order: string, value: unknown, type = 'TEXTO_CORTO') {
  return { [order]: { value, type } };
}

describe('StubAIProvider.extractLabs — A-C1 (CS2: nunca fabricar labs)', () => {
  const stub = new StubAIProvider();

  it('sin adjuntos → labs vacíos', async () => {
    const r = await stub.extractLabs([]);
    expect(r.labs).toEqual([]);
  });

  it('CON adjuntos → labs vacíos igual (no inventa valores para el paciente real)', async () => {
    const r = await stub.extractLabs([{ filename: 'hemograma.pdf', bytes: Buffer.from('x'), mime: 'application/pdf' } as never]);
    expect(r.labs).toEqual([]);
    // El fixture Uribe NO debe aparecer por el solo hecho de haber adjunto.
    expect(r.labs.find((l) => l.value === '15.9')).toBeUndefined();
    // perFile sí refleja el archivo procesado (para trazabilidad de la cascada).
    expect(r.perFile).toHaveLength(1);
    expect(r.perFile[0]?.file).toBe('hemograma.pdf');
  });

  it('el fixture Uribe existe solo como dato de test, desacoplado del stub', () => {
    expect(FIXTURE_HEMOGRAMA_URIBE[0]?.value).toBe('15.9');
  });
});

describe('getAIProvider — A-A1 (fail-closed en producción)', () => {
  // vi.stubEnv maneja NODE_ENV (read-only en el tipo) y restaura tras cada test.
  afterEach(() => vi.unstubAllEnvs());

  it('producción + AI_PROVIDER ausente → lanza (no cae al stub en silencio)', () => {
    vi.stubEnv('AI_PROVIDER', undefined as never);
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => getAIProvider()).toThrow(/AI_PROVIDER no está definido en producción/);
  });

  it('dev + AI_PROVIDER ausente → stub (se permite trabajar sin key)', () => {
    vi.stubEnv('AI_PROVIDER', undefined as never);
    vi.stubEnv('NODE_ENV', 'development');
    expect(getAIProvider()).toBeInstanceOf(StubAIProvider);
  });

  it('AI_PROVIDER="stub" explícito → stub', () => {
    vi.stubEnv('AI_PROVIDER', 'stub');
    expect(getAIProvider()).toBeInstanceOf(StubAIProvider);
  });

  it('AI_PROVIDER desconocido → lanza (no cae al stub)', () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    expect(() => getAIProvider()).toThrow(/no reconocido/);
  });

  it('AI_PROVIDER="anthropic" sin key → lanza', () => {
    vi.stubEnv('AI_PROVIDER', 'anthropic');
    vi.stubEnv('ANTHROPIC_API_KEY', undefined as never);
    expect(() => getAIProvider()).toThrow(/requiere ANTHROPIC_API_KEY/);
  });
});

describe('StubAIProvider.generateAssessment — A-A2 (provenance del sexo)', () => {
  const stub = new StubAIProvider();
  const baseAnswers = (over: Record<string, unknown>) => ({
    ...answer('ID01', 'Paciente Prueba'),
    ...answer('ID04', 'Hombre', 'SELECCION_UNICA'),
    ...over,
  });

  it('sexo declarado (ID04) sin edad → fuente formulario:ID04, NO derivado:IA', async () => {
    // Sin fecha de nacimiento ni de agenda no hay edad; queda el sexo, dato verbatim del paciente.
    const doc = await stub.generateAssessment({ caseId: 'c1', answers: baseAnswers({}) as never, labs: [], glp1: { declared: false }, imc: null, pesoKg: null, tallaCm: null });
    const f = doc.identificacion['edad_sexo'];
    expect(f?.valor).toBe('Masculino');
    expect(f?.fuente).toBe('formulario:ID04');
    expect(f?.fuente).not.toContain('derivado:IA');
  });

  it('edad + sexo → fuente compuesta (ID04 + edad derivada), no derivado:IA a secas', async () => {
    const answers = baseAnswers({ ...answer('ID03', '1990-05-10', 'FECHA') });
    const doc = await stub.generateAssessment({ caseId: 'c2', answers: answers as never, labs: [], glp1: { declared: false }, imc: null, pesoKg: null, tallaCm: null, fechaProcedimiento: '2026-05-10' });
    const f = doc.identificacion['edad_sexo'];
    expect(f?.valor).toContain('Masculino');
    expect(f?.fuente).toContain('formulario:ID04'); // el sexo se atribuye al paciente
    expect(f?.fuente).toContain('derivado:IA');   // la edad sí es derivada
  });
});

describe('StubAIProvider — C-3 (coma decimal en peso/talla)', () => {
  const stub = new StubAIProvider();

  it('peso "78,5" y talla "1,75" con coma → se normalizan en peso_talla_imc (no salen con coma)', async () => {
    const answers = {
      ...answer('ID01', 'Coma Test'),
      ...answer('ID10', '78,5', 'NUMERO'),
      ...answer('ID11', '175', 'NUMERO'),
    };
    // imc lo calcula el ensamblaje; aquí pasamos uno para ver el formato del stub.
    const doc = await stub.generateAssessment({ caseId: 'c3', answers: answers as never, labs: [], glp1: { declared: false }, imc: 25.6, pesoKg: 78.5, tallaCm: 175 });
    const f = doc.identificacion['peso_talla_imc'];
    expect(f?.valor).toContain('78.5 kg'); // coma normalizada a punto
    expect(f?.valor).toContain('1.75 m');
    expect(f?.valor).not.toContain('78,5'); // nunca con coma
  });
});
