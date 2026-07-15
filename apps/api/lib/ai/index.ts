import type { DocumentJSON } from '@anestia/shared';

/**
 * AIProvider — ÚNICO punto de dependencia de la key. Dos métodos:
 *  - extractLabs: extrae valores de laboratorio (visión). NUNCA fabrica valores ausentes (CS2).
 *  - generateAssessment: genera el documento clínico estructurado (CS5).
 *
 * Factory getAIProvider() lee AI_PROVIDER=stub|anthropic. En el piloto: stub.
 * El stub devuelve el caso de referencia del Anexo C (Uribe) para construir todo aguas abajo sin key.
 */
export interface FileRef {
  key: string;
  type: string;
  filename: string;
}

export interface ExtractedLab {
  analyte: string;
  value: string;
  unit?: string;
  refRange?: string;
  sourceRef?: string;
}

export interface ClinicalInput {
  caseId: string;
  answers: Record<string, unknown>;
  labs: ExtractedLab[];
  glp1?: { declared: boolean; lastDose?: string };
  imc?: number;
}

export interface AIProvider {
  extractLabs(files: FileRef[]): Promise<ExtractedLab[]>;
  generateAssessment(input: ClinicalInput): Promise<DocumentJSON>;
}

/** Stub: valores de ejemplo del Anexo C. Sólo para desarrollo sin key. */
class StubAIProvider implements AIProvider {
  async extractLabs(files: FileRef[]): Promise<ExtractedLab[]> {
    // Sin adjuntos → no hay nada que extraer (CS2: nunca fabricar).
    if (!files || files.length === 0) return [];
    // Caso de referencia (Anexo C, Uribe): hemograma + coagulación en rango.
    return [
      { analyte: 'Hemoglobina', value: '15.9', unit: 'g/dL', refRange: '13-17', sourceRef: 'stub:hemograma:hb' },
      { analyte: 'Hematocrito', value: '48.2', unit: '%', refRange: '40-52', sourceRef: 'stub:hemograma:hto' },
      { analyte: 'Plaquetas', value: '244000', unit: '/uL', refRange: '150000-450000', sourceRef: 'stub:hemograma:plt' },
      { analyte: 'Leucocitos', value: '7200', unit: '/uL', refRange: '4000-11000', sourceRef: 'stub:hemograma:wbc' },
      { analyte: 'TP', value: '10.4', unit: 's', refRange: '10-13', sourceRef: 'stub:coagulacion:tp' },
      { analyte: 'INR', value: '0.97', unit: '', refRange: '0.9-1.2', sourceRef: 'stub:coagulacion:inr' },
      { analyte: 'TPT', value: '29.5', unit: 's', refRange: '25-35', sourceRef: 'stub:coagulacion:tpt' },
    ];
  }

  async generateAssessment(input: ClinicalInput): Promise<DocumentJSON> {
    // Stub: construye el documento con los datos REALES del caso donde existan
    // (identificación, antecedentes, paraclínicos); narrativos derivados de ejemplo;
    // examen físico TODO pendiente (los guardarraíles lo re-fuerzan igualmente).
    const a = input.answers ?? {};
    const val = (order: string): string | null => {
      const v = a[order]?.value;
      if (v == null || v === '') return null;
      return Array.isArray(v) ? v.join(', ') : String(v);
    };
    const ok = (valor: string | null, fuente: string): DocField =>
      valor != null
        ? { valor, estado: 'ok', fuente }
        : { valor: null, estado: 'no_reportado', fuente: null };

    const glp1 = input.glp1?.declared;
    const recomendaciones = glp1
      ? 'Ayuno de 8 horas; dieta líquida en las 24 horas previas; confirmar ausencia de náuseas, vómito o distensión. Ante uso de agonista GLP-1, considerar ecografía gástrica y manejar como estómago lleno o diferir si hay riesgo de contenido gástrico residual.'
      : 'Ayuno según protocolo institucional; confirmar condiciones el día del procedimiento.';

    return {
      identificacion: {
        paciente: ok(val('1'), 'formulario:P1'),
        documento: ok(val('2'), 'formulario:P2'),
        sexo: ok(val('4'), 'formulario:P4'),
        procedimiento: ok(val('9'), 'formulario:P9'),
        // imc lo fija el guardarraíl (código)
        diagnostico_preoperatorio: val('9')
          ? { valor: `Paciente programado para ${val('9')}`, estado: 'ok', fuente: 'derivado:IA' }
          : { valor: null, estado: 'no_reportado', fuente: null },
        asa: { valor: 'II', estado: 'ok', fuente: 'derivado:IA' },
      },
      antecedentes: {
        patologicos: ok(val('13') ?? val('12'), 'formulario:P12-13'),
        medicamentos: ok(val('14'), 'formulario:P14'),
        glp1: glp1
          ? { valor: `Agonista GLP-1 declarado (${input.glp1.drug})`, estado: 'ok', fuente: 'derivado:P14', alerta: true }
          : { valor: null, estado: 'no_reportado', fuente: null },
        alergias: ok(val('15'), 'formulario:P15'),
        grupo_sanguineo: ok(val('11'), 'formulario:P11'),
        transfusionales: ok(val('17'), 'formulario:P17'),
        protesis_dental: ok(val('22'), 'formulario:P22'),
      },
      paraclinicos: Object.fromEntries(
        (input.labs ?? []).map((l) => [
          l.analyte.toLowerCase().replace(/\s+/g, '_'),
          {
            valor: `${l.value}${l.unit ? ' ' + l.unit : ''}`,
            estado: 'ok' as const,
            fuente: l.sourceRef ?? 'lab',
            alerta: l.flag !== 'NORMAL',
          },
        ]),
      ),
      examen_fisico: {}, // el guardarraíl lo llena todo como pendiente_examen
      valoracion_plan: {
        concepto: {
          valor: 'Paciente apto para el procedimiento electivo, condicionado a la verificación del examen físico presencial y a los hallazgos paraclínicos disponibles.',
          estado: 'ok',
          fuente: 'derivado:IA',
        },
        plan: { valor: 'Anestesia general (borrador, verificar).', estado: 'ok', fuente: 'derivado:IA' },
        recomendaciones: { valor: recomendaciones, estado: 'ok', fuente: 'derivado:IA', alerta: glp1 },
      },
    };
  }
}

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? 'stub';
  switch (provider) {
    case 'anthropic':
      // Se implementa en U2/U3 cuando exista ANTHROPIC_API_KEY. Punto único de cambio.
      throw new Error('AIProvider "anthropic" aún no implementado (llega en U2/U3 con la key).');
    case 'stub':
    default:
      return new StubAIProvider();
  }
}
