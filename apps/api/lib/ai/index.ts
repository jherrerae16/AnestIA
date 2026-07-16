import { medicalTerm, suggestASA, type DocumentJSON, type DocField } from '@anestia/shared';

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
  unit?: string | null;
  refRange?: string | null;
  sourceRef?: string | null;
}

/** Lab con flag ya aplicado (entrada al motor clínico). */
export interface FlaggedLab extends ExtractedLab {
  flag: string;
}

export interface ClinicalInput {
  caseId: string;
  answers: Record<string, { value: unknown; type: string }>;
  labs: FlaggedLab[];
  glp1?: { declared: boolean; drug?: string; lastDose?: string };
  imc?: number | null;
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
    // Stub: documento construido SÓLO con datos reales del formulario del Dr. Luquetta.
    // Redacción clínica profesional para respuestas Sí/No. Examen físico = pendiente (CS3).
    // Mapeo (Google Form real): P1 nombre, P2 doc, P3 nacimiento, P4 sexo, P5 tel, P6 aseguradora,
    // P7 procedimiento, P8 fecha cirugía, P9 grupo sanguíneo, P10 ¿enfermedad?, P11 patologías,
    // P12 ¿medicamentos?, P13 ¿alergias?, P14 ¿cirugía previa?, P15 ¿transfusión?, P16 ¿prótesis?,
    // P17 ¿fuma?, P18 cigarrillos/día, P19 ¿alcohol?, P20 ¿psicoactivas?, P21 correo.
    const a = input.answers ?? {};
    const val = (order: string): string | null => {
      const v = a[order]?.value;
      if (v == null || v === '') return null;
      return Array.isArray(v) ? v.join(', ') : String(v);
    };
    /** ¿La respuesta Sí/No es afirmativa? Normaliza 'sí'→'si'. */
    const isYes = (order: string): boolean => {
      const v = (val(order) ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return v === 'si' || v === 'true';
    };
    const ok = (valor: string | null, fuente: string): DocField =>
      valor != null ? { valor, estado: 'ok', fuente } : { valor: null, estado: 'no_reportado', fuente: null };
    const derived = (valor: string, fuente = 'derivado:IA'): DocField => ({ valor, estado: 'ok', fuente });
    const noRep = (): DocField => ({ valor: null, estado: 'no_reportado', fuente: null });
    /** Capitaliza la primera letra. */
    const sentence = (s: string | null): string | null =>
      s ? s.charAt(0).toLocaleUpperCase('es') + s.slice(1) : s;

    // Procedimiento (P9): traduce lenguaje coloquial → término médico ('lipo' → 'Liposucción').
    const procedimiento = medicalTerm(val('9'));

    // --- Edad (derivada de P3 nacimiento vs P10 fecha de cirugía; sin Date.now) ---
    let edadStr: string | null = null;
    const birth = val('3');
    if (birth) {
      const d = new Date(birth);
      const refRaw = val('10');
      const ref = refRaw ? new Date(refRaw) : null;
      if (!isNaN(d.getTime()) && ref && !isNaN(ref.getTime())) {
        let age = ref.getFullYear() - d.getFullYear();
        const m = ref.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
        if (age >= 0 && age < 130) edadStr = `${age} años`;
      }
    }
    // Sexo: normaliza Hombre→Masculino, Mujer→Femenino (tono clínico).
    const sexoRaw = (val('4') ?? '').toLowerCase();
    const sexo = /^(hombre|masc|m$)/.test(sexoRaw) ? 'Masculino'
      : /^(mujer|feme|f$)/.test(sexoRaw) ? 'Femenino'
      : val('4') ? sentence(val('4')) : null;
    let edadSexo: DocField;
    if (edadStr && sexo) edadSexo = derived(`${edadStr} / ${sexo}`);
    else if (edadStr) edadSexo = derived(edadStr);
    else if (sexo) edadSexo = ok(sexo, 'formulario:P4');
    else edadSexo = noRep();

    // --- Peso / Talla / IMC (P5 kg, P6 cm) → combinado + IMC calculado ---
    const pesoRaw = val('5');
    const tallaRaw = val('6');
    let pesoTallaImc: DocField = noRep();
    if (pesoRaw && tallaRaw) {
      const cm = parseFloat(tallaRaw.replace(',', '.'));
      const metros = !isNaN(cm) ? (cm > 3 ? cm / 100 : cm) : NaN;
      const tallaStr = !isNaN(metros) ? `${metros.toFixed(2)} m` : tallaRaw;
      const imcStr = input.imc != null ? ` / ${input.imc.toFixed(1)} kg/m²` : '';
      pesoTallaImc = derived(`${pesoRaw} kg / ${tallaStr}${imcStr}`, input.imc != null ? 'derivado:IA' : 'formulario:P5-6');
    }

    // --- Fecha del procedimiento (P10) → formato dd-mm-aaaa ---
    const fechaProc = ((): DocField => {
      const raw = val('10');
      if (!raw) return noRep();
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return ok(m ? `${m[3]}-${m[2]}-${m[1]}` : raw, 'formulario:P10');
    })();

    // ── ANTECEDENTES: redacción clínica desde Sí/No ──
    // Patológicos: P12 ¿enfermedad? → P13 patologías (multi) si Sí.
    let patologicos: DocField;
    if (isYes('12')) {
      const lista = val('13');
      patologicos = lista
        ? ok(`Refiere ${lista.toLocaleLowerCase('es')}.`, 'formulario:P12-13')
        : ok('Refiere antecedentes patológicos (sin especificar).', 'formulario:P12');
    } else {
      patologicos = derived('Niega antecedentes patológicos conocidos.', 'formulario:P12');
    }

    const medicamentos = isYes('14')
      ? ok('Refiere consumo actual de medicamentos.', 'formulario:P14')
      : derived('Niega consumo de medicamentos.', 'formulario:P14');

    const alergias = isYes('15')
      ? ok('Refiere alergias medicamentosas o a otras sustancias.', 'formulario:P15')
      : derived('Niega alergias medicamentosas o a otras sustancias.', 'formulario:P15');

    // Cirugías previas (P16): si Sí y hay detalle (P17), traduce a término médico.
    const quirurgicos = isYes('16')
      ? (() => {
          const detalle = medicalTerm(val('17'));
          return detalle
            ? ok(`Refiere ${detalle.toLocaleLowerCase('es')}.`, 'formulario:P16-17')
            : ok('Refiere procedimientos quirúrgicos o anestésicos previos.', 'formulario:P16');
        })()
      : derived('Niega procedimientos quirúrgicos o anestésicos previos.', 'formulario:P16');

    const transfusionales = isYes('18')
      ? ok('Refiere transfusión sanguínea previa.', 'formulario:P18')
      : derived('Niega transfusiones previas.', 'formulario:P18');

    const protesis = isYes('19')
      ? ok('Refiere prótesis dental o diseño de sonrisa (relevante para el manejo de la vía aérea).', 'formulario:P19')
      : derived('Niega prótesis dental o diseño de sonrisa.', 'formulario:P19');

    // Hábitos: P20 tabaco/vapeo (+P21 cantidad), P22 alcohol, P23 psicoactivas.
    const habitos = ((): DocField => {
      const positivos: string[] = [];
      if (isYes('20')) {
        const cant = val('21');
        positivos.push(cant ? `tabaquismo/vapeo (${cant})` : 'tabaquismo/vapeo');
      }
      if (isYes('22')) positivos.push('consumo de alcohol');
      if (isYes('23')) positivos.push('consumo de sustancias psicoactivas');
      if (positivos.length === 0) {
        return derived('Niega tabaquismo, vapeo, consumo de alcohol y sustancias psicoactivas.', 'formulario:P20-23');
      }
      return ok(`Refiere ${positivos.join(', ')}.`, 'formulario:P20-23');
    })();

    // Condición actual: derivada del reporte de enfermedad (P12). El médico confirma.
    const condicionActual: DocField = isYes('12')
      ? derived('Sintomático / en estudio')
      : derived('Asintomático');

    // ASA: sugerido desde comorbilidades declaradas (P13 patologías). Marcado como derivado
    // para que el anestesiólogo lo confirme (CS4).
    const comorbilidades = isYes('12') && val('13') ? val('13')!.split(',').map((s) => s.trim()) : [];
    const asaSug = suggestASA(comorbilidades);
    const asaField: DocField = { valor: `ASA ${asaSug.grado}`, estado: 'ok', fuente: 'derivado:IA', nota: asaSug.justificacion };

    const glp1 = input.glp1?.declared;
    const recomendaciones = glp1
      ? 'Ayuno de 8 horas; dieta líquida durante las 24 horas previas; confirmar ausencia de náuseas, vómito, distensión o dolor abdominal. Ante uso de agonista GLP-1, considerar ecografía gástrica y manejar como estómago lleno o diferir el procedimiento si existe riesgo de contenido gástrico residual.'
      : 'Ayuno según protocolo institucional; confirmar condiciones del paciente el día del procedimiento.';

    return {
      identificacion: {
        paciente: ok(val('1'), 'formulario:P1'),
        documento: ok(val('2'), 'formulario:P2'),
        edad_sexo: edadSexo,
        peso_talla_imc: pesoTallaImc,
        procedimiento: ok(procedimiento, 'formulario:P9'),
        fecha_procedimiento: fechaProc,
        fecha_valoracion: noRep(), // la inyecta el renderer (opts.fechaValoracion)
        capacidad_funcional: derived('≥4 METs'),
        tipo_cirugia: derived('Electiva'),
        condicion_actual: condicionActual,
        // Diagnóstico preoperatorio: nombre de la cirugía (término médico). El médico lo
        // reemplaza por el diagnóstico clínico real si aplica.
        diagnostico_preoperatorio: procedimiento ? derived(procedimiento) : noRep(),
        asa: asaField,
      },
      antecedentes: {
        patologicos,
        medicamentos,
        glp1: glp1
          ? { valor: `Uso declarado de agonista GLP-1 (${input.glp1?.drug ?? 'no especificado'}).`, estado: 'ok', fuente: 'derivado:IA', alerta: true }
          : noRep(),
        alergias,
        quirurgicos,
        grupo_sanguineo: ok(val('11'), 'formulario:P11'),
        transfusionales,
        protesis_dental: protesis,
        habitos,
      },
      paraclinicos: ((): Record<string, DocField> => {
        const labs = input.labs ?? [];
        const out: Record<string, DocField> = {};
        for (const l of labs) {
          out[l.analyte.toLowerCase().replace(/\s+/g, '_')] = {
            valor: `${l.value}${l.unit ? ' ' + l.unit : ''}`,
            estado: 'ok',
            fuente: l.sourceRef ?? 'lab',
            alerta: l.flag !== 'NORMAL',
          };
        }
        // Observación resumen: menciona hallazgos alterados o normalidad global.
        if (labs.length > 0) {
          const alterados = labs.filter((l) => l.flag !== 'NORMAL');
          out['observacion'] = alterados.length > 0
            ? { valor: `Se observa alteración en: ${alterados.map((l) => `${l.analyte} (${l.flag.toLowerCase()})`).join(', ')}. Correlacionar clínicamente.`, estado: 'ok', fuente: 'derivado:IA', alerta: true }
            : { valor: 'Sin alteraciones hematológicas ni de coagulación relevantes.', estado: 'ok', fuente: 'derivado:IA' };
        }
        return out;
      })(),
      examen_fisico: {}, // el guardarraíl lo llena todo como pendiente_examen
      valoracion_plan: {
        concepto: {
          valor: (() => {
            const partes: string[] = [];
            const edadTxt = edadStr ? `Paciente de ${edadStr}` : 'Paciente';
            partes.push(`${edadTxt} con capacidad funcional estimada ≥4 METs.`);
            if (!isYes('12')) partes.push('Sin comorbilidades sistémicas documentadas.');
            else if (val('13')) partes.push(`Antecedentes de ${val('13')!.toLocaleLowerCase('es')} a considerar en el manejo perioperatorio.`);
            if ((input.labs ?? []).some((l) => l.flag !== 'NORMAL')) partes.push('Hallazgos paraclínicos alterados a correlacionar (ver paraclínicos).');
            else if ((input.labs ?? []).length > 0) partes.push('Hemograma y pruebas de coagulación dentro de rango.');
            if (glp1) partes.push('Uso declarado de agonista GLP-1: manejar el riesgo de contenido gástrico residual (ver recomendaciones).');
            partes.push(`Riesgo anestésico ${asaField.valor}. Apto para cirugía electiva, condicionado a la verificación del examen físico presencial y a los hallazgos paraclínicos disponibles.`);
            return partes.join(' ');
          })(),
          estado: 'ok',
          fuente: 'derivado:IA',
        },
        plan: derived('Anestesia general.'),
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
