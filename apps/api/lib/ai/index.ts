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

  async generateAssessment(_input: ClinicalInput): Promise<DocumentJSON> {
    // Esqueleto: examen físico en pendiente_examen (CS3). Se completa en U3.
    return {
      identificacion: {},
      antecedentes: {},
      paraclinicos: {},
      examen_fisico: {
        signos_vitales: { valor: null, estado: 'pendiente_examen', fuente: null },
        via_aerea: { valor: null, estado: 'pendiente_examen', fuente: null },
      },
      valoracion_plan: {},
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
