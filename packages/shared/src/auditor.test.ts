import { describe, it, expect } from 'vitest';
import { auditDocument, type AuditAnswers } from './auditor';
import type { DocumentJSON, DocField } from './document';
import { EXAM_FIELDS } from './clinical';

const ok = (valor: string, fuente = 'formulario:P1'): DocField => ({ valor, estado: 'ok', fuente });
const pending = (): DocField => ({ valor: null, estado: 'pendiente_examen', fuente: null });

function baseDoc(over: Partial<DocumentJSON> = {}): DocumentJSON {
  return {
    identificacion: { paciente: ok('Ana Pérez'), documento: ok('123') },
    antecedentes: {
      patologicos: ok('Niega antecedentes patológicos conocidos.', 'formulario:P12'),
      medicamentos: ok('Niega consumo de medicamentos.', 'formulario:P14'),
      alergias: ok('Niega alergias medicamentosas o a otras sustancias.', 'formulario:P16'),
      quirurgicos: ok('Niega procedimientos quirúrgicos o anestésicos previos.', 'formulario:P18'),
      transfusionales: ok('Niega transfusiones previas.', 'formulario:P20'),
      protesis_dental: ok('Niega prótesis dental o diseño de sonrisa.', 'formulario:P21'),
    },
    paraclinicos: {},
    examen_fisico: Object.fromEntries(EXAM_FIELDS.map((k) => [k, pending()])),
    valoracion_plan: { concepto: ok('Apto para cirugía electiva.', 'derivado:IA') },
    ...over,
  } as DocumentJSON;
}

const sanoAnswers: AuditAnswers = {
  '12': { value: 'no' }, '14': { value: 'no' }, '16': { value: 'no' },
  '18': { value: 'no' }, '20': { value: 'no' }, '21': { value: 'no' },
  '22': { value: 'no' }, '24': { value: 'no' }, '25': { value: 'no' },
};

describe('auditor — seguridad dura (bloqueante)', () => {
  it('bloquea si un campo tiene contenido sin fuente', () => {
    const doc = baseDoc();
    (doc.antecedentes as Record<string, DocField>)['alergias'] = { valor: 'Penicilina', estado: 'ok', fuente: null };
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.blocked).toBe(true);
    expect(r.findings.some((f) => f.level === 'bloqueante' && f.category === 'seguridad')).toBe(true);
  });

  it('bloquea si el examen físico trae un valor que no puso el anestesiólogo', () => {
    const doc = baseDoc();
    (doc.examen_fisico as Record<string, DocField>)['snc'] = { valor: 'Alerta, orientado', estado: 'ok', fuente: 'derivado:IA' };
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.blocked).toBe(true);
    expect(r.findings.some((f) => f.field === 'examen_fisico.snc')).toBe(true);
  });

  it('NO bloquea si el examen lo registró el anestesiólogo', () => {
    const doc = baseDoc();
    (doc.examen_fisico as Record<string, DocField>)['snc'] = {
      valor: 'Alerta, orientado', estado: 'ok', fuente: 'anestesiologo:examen-normal-confirmado',
    };
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.blocked).toBe(false);
  });

  it('paciente sano coherente → sin bloqueantes', () => {
    const r = auditDocument({ doc: baseDoc(), answers: sanoAnswers });
    expect(r.blocked).toBe(false);
  });
});

describe('auditor — contradicciones', () => {
  it('detecta negar enfermedad pero marcar patologías', () => {
    const answers: AuditAnswers = { ...sanoAnswers, '12': { value: 'no' }, '13': { value: ['Hipertensión arterial'] } };
    const r = auditDocument({ doc: baseDoc(), answers });
    expect(r.findings.some((f) => f.category === 'contradiccion' && /P12/.test(f.message))).toBe(true);
    expect(r.blocked).toBe(false); // sólo advertencia: decide el médico
  });

  it('detecta negar medicamentos pero declarar semaglutida', () => {
    const answers: AuditAnswers = { ...sanoAnswers, '14': { value: 'no' }, '15': { value: 'semaglutida' } };
    const r = auditDocument({ doc: baseDoc(), answers });
    expect(r.findings.some((f) => f.category === 'contradiccion' && /semaglutida/.test(f.message))).toBe(true);
  });

  it('detecta negar fumar pero reportar cigarrillos/día', () => {
    const answers: AuditAnswers = { ...sanoAnswers, '22': { value: 'no' }, '23': { value: '5' } };
    const r = auditDocument({ doc: baseDoc(), answers });
    expect(r.findings.some((f) => f.category === 'contradiccion' && /P22/.test(f.message))).toBe(true);
  });
});

describe('auditor — filas huérfanas', () => {
  it('marca fila ok sin contenido', () => {
    const doc = baseDoc();
    (doc.antecedentes as Record<string, DocField>)['alergias'] = { valor: '', estado: 'ok', fuente: 'formulario:P16' };
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'fila_huerfana')).toBe(true);
  });

  it('marca placeholder sin valor clínico', () => {
    const doc = baseDoc();
    (doc.antecedentes as Record<string, DocField>)['alergias'] = { valor: 'N/A', estado: 'ok', fuente: 'formulario:P16' };
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'fila_huerfana')).toBe(true);
  });
});

describe('auditor — completitud condicional', () => {
  it('exige recomendaciones de ayuno si hay GLP-1', () => {
    const doc = baseDoc();
    (doc.antecedentes as Record<string, DocField>)['glp1'] = ok('Uso declarado de agonista GLP-1 (semaglutida).', 'derivado:IA');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'completitud' && /GLP-1/.test(f.message))).toBe(true);
  });

  it('no se queja si las recomendaciones ya cubren el ayuno', () => {
    const doc = baseDoc();
    (doc.antecedentes as Record<string, DocField>)['glp1'] = ok('Uso declarado de agonista GLP-1 (semaglutida).', 'derivado:IA');
    (doc.valoracion_plan as Record<string, DocField>)['recomendaciones'] = ok('Ayuno de 8 horas; considerar ecografía gástrica.', 'derivado:IA');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => /GLP-1/.test(f.message) && f.category === 'completitud')).toBe(false);
  });

  it('exige que un lab alterado se mencione en el concepto', () => {
    const r = auditDocument({
      doc: baseDoc(), answers: sanoAnswers,
      labs: [{ analyte: 'Hemoglobina', flag: 'CRITICO' }],
    });
    expect(r.findings.some((f) => f.category === 'completitud' && /Hemoglobina/.test(f.message))).toBe(true);
  });
});

describe('auditor — coherencia respuesta ↔ documento', () => {
  it('marca un "sí" que el documento no refleja', () => {
    const doc = baseDoc();
    delete (doc.antecedentes as Record<string, DocField>)['alergias'];
    const answers: AuditAnswers = { ...sanoAnswers, '16': { value: 'si' } };
    const r = auditDocument({ doc, answers });
    expect(r.findings.some((f) => f.category === 'coherencia' && /alergias/.test(f.message))).toBe(true);
  });
});

describe('auditor — redacción (lenguaje de IA prohibido)', () => {
  it('detecta "se sugiere" en las recomendaciones', () => {
    const doc = baseDoc();
    (doc.valoracion_plan as Record<string, DocField>)['recomendaciones'] = ok('Se sugiere ayuno de 8 horas.', 'derivado:IA');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'redaccion' && f.field === 'valoracion_plan.recomendaciones')).toBe(true);
    expect(r.blocked).toBe(false); // advertencia, no bloquea
  });

  it('detecta "podría" en el concepto', () => {
    const doc = baseDoc();
    (doc.valoracion_plan as Record<string, DocField>)['concepto'] = ok('El paciente podría tolerar la anestesia general.', 'derivado:IA');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'redaccion' && /podría/.test(f.message))).toBe(true);
  });

  it('detecta "según la información proporcionada"', () => {
    const doc = baseDoc();
    (doc.valoracion_plan as Record<string, DocField>)['plan'] = ok('Según la información proporcionada, se planea anestesia regional.', 'derivado:IA');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'redaccion')).toBe(true);
  });

  it('prosa clínica limpia → sin hallazgo de redacción', () => {
    const r = auditDocument({ doc: baseDoc(), answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'redaccion')).toBe(false);
  });
});

describe('auditor — terminología (coloquialismo sin traducir)', () => {
  it('marca "operación de vesícula" crudo en el procedimiento', () => {
    const doc = baseDoc();
    (doc.identificacion as Record<string, DocField>)['procedimiento'] = ok('vesicula', 'formulario:P3');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'terminologia' && f.field === 'identificacion.procedimiento')).toBe(true);
  });

  it('no se queja si el procedimiento ya está en término médico', () => {
    const doc = baseDoc();
    (doc.identificacion as Record<string, DocField>)['procedimiento'] = ok('Colecistectomía', 'formulario:P3');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'terminologia')).toBe(false);
  });
});

describe('auditor — ortografía', () => {
  it('marca espacios dobles en la prosa', () => {
    const doc = baseDoc();
    (doc.valoracion_plan as Record<string, DocField>)['concepto'] = ok('Apto para  cirugía electiva.', 'derivado:IA');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'ortografia')).toBe(true);
    expect(r.blocked).toBe(false);
  });

  it('marca minúscula inicial', () => {
    const doc = baseDoc();
    (doc.valoracion_plan as Record<string, DocField>)['concepto'] = ok('apto para cirugía electiva.', 'derivado:IA');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => f.category === 'ortografia' && /mayúscula/.test(f.message))).toBe(true);
  });
});

describe('auditor — ASA vs comorbilidades', () => {
  it('marca ASA I con comorbilidades declaradas', () => {
    const doc = baseDoc();
    (doc.identificacion as Record<string, DocField>)['asa'] = ok('ASA I', 'derivado:IA');
    const answers: AuditAnswers = { ...sanoAnswers, '12': { value: 'si' }, '13': { value: ['Hipertensión arterial'] } };
    const r = auditDocument({ doc, answers });
    expect(r.findings.some((f) => f.category === 'coherencia' && /ASA/.test(f.message))).toBe(true);
  });

  it('no se queja si ASA I y paciente realmente sano', () => {
    const doc = baseDoc();
    (doc.identificacion as Record<string, DocField>)['asa'] = ok('ASA I', 'derivado:IA');
    const r = auditDocument({ doc, answers: sanoAnswers });
    expect(r.findings.some((f) => /Revisar la clasificación ASA/.test(f.message))).toBe(false);
  });
});

describe('auditor — interpretación de medicamentos de riesgo', () => {
  it('marca anticoagulante declarado no reflejado en la valoración', () => {
    const doc = baseDoc();
    const answers: AuditAnswers = { ...sanoAnswers, '14': { value: 'si' }, '15': { value: 'warfarina' } };
    const r = auditDocument({ doc, answers });
    expect(r.findings.some((f) => f.category === 'completitud' && /anticoagulante/.test(f.message))).toBe(true);
  });

  it('no se queja si el manejo del anticoagulante ya aparece', () => {
    const doc = baseDoc();
    (doc.valoracion_plan as Record<string, DocField>)['recomendaciones'] = ok('Suspender warfarina 5 días antes; puente con heparina según riesgo.', 'derivado:IA');
    const answers: AuditAnswers = { ...sanoAnswers, '14': { value: 'si' }, '15': { value: 'warfarina' } };
    const r = auditDocument({ doc, answers });
    expect(r.findings.some((f) => /anticoagulante cumarínico/.test(f.message))).toBe(false);
  });
});
