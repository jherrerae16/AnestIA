import { medicalTerm, suggestASA, formatDocumentId, type DocumentJSON, type DocField } from '@anestia/shared';

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
  /** Tipo de estudio leído del informe (hemograma, coagulación…). Lo asigna el extractor. */
  grupo?: string | null;
  /** Fecha del informe (AAAA-MM-DD) leída del examen, no la de carga. Vacía si no la trae. */
  reportDate?: string | null;
  sourceRef?: string | null;
  /** Capa que produjo este lab en la cascada ('texto'|'vision'). La pone el adaptador. */
  extractionLayer?: 'texto' | 'vision';
}

/** Lab con flag ya aplicado (entrada al motor clínico). */
export interface FlaggedLab extends ExtractedLab {
  flag: string;
}

/** Método de extracción: 'capas' (texto+fallback visión) o 'vision' (forzado). */
export type ExtractionMethod = 'capas' | 'vision';

/** Qué capa resolvió cada archivo — para el audit log (fallback nunca silencioso). */
export interface FileExtractionInfo {
  file: string;
  layer: 'texto' | 'vision';
  /** Motivo del fallback a visión cuando el texto no sirvió. */
  fallbackReason?: 'sin_texto' | 'ilegible' | 'no_parece_lab' | 'error';
}

/** Resultado de extractLabs: los labs + cómo se resolvió cada archivo. */
export interface ExtractLabsResult {
  labs: ExtractedLab[];
  perFile: FileExtractionInfo[];
}

export interface ClinicalInput {
  caseId: string;
  answers: Record<string, { value: unknown; type: string }>;
  labs: FlaggedLab[];
  glp1?: { declared: boolean; drug?: string; lastDose?: string };
  imc?: number | null;
}

export interface AIProvider {
  extractLabs(files: FileRef[], method?: ExtractionMethod): Promise<ExtractLabsResult>;
  generateAssessment(input: ClinicalInput): Promise<DocumentJSON>;
}

/** Stub: valores de ejemplo del Anexo C. Sólo para desarrollo sin key. */
class StubAIProvider implements AIProvider {
  async extractLabs(files: FileRef[], method: ExtractionMethod = 'capas'): Promise<ExtractLabsResult> {
    // Sin adjuntos → no hay nada que extraer (CS2: nunca fabricar).
    if (!files || files.length === 0) return { labs: [], perFile: [] };
    // Caso de referencia (Anexo C, Uribe): hemograma + coagulación en rango.
    // El stub no lee archivos: se etiqueta como 'texto' en modo capas, 'vision' en modo visión.
    const layer = method === 'vision' ? 'vision' : ('texto' as const);
    const labs: ExtractedLab[] = [
      { analyte: 'Hemoglobina', value: '15.9', unit: 'g/dL', refRange: '13-17', grupo: 'hemograma', reportDate: '2026-07-10', sourceRef: 'stub:hemograma:hb' },
      { analyte: 'Hematocrito', value: '48.2', unit: '%', refRange: '40-52', grupo: 'hemograma', reportDate: '2026-07-10', sourceRef: 'stub:hemograma:hto' },
      { analyte: 'Plaquetas', value: '244000', unit: '/uL', refRange: '150000-450000', grupo: 'hemograma', reportDate: '2026-07-10', sourceRef: 'stub:hemograma:plt' },
      { analyte: 'Leucocitos', value: '7200', unit: '/uL', refRange: '4000-11000', grupo: 'hemograma', reportDate: '2026-07-10', sourceRef: 'stub:hemograma:wbc' },
      { analyte: 'TP', value: '10.4', unit: 's', refRange: '10-13', grupo: 'coagulacion', reportDate: '2026-07-10', sourceRef: 'stub:coagulacion:tp' },
      { analyte: 'INR', value: '0.97', unit: '', refRange: '0.9-1.2', grupo: 'coagulacion', reportDate: '2026-07-10', sourceRef: 'stub:coagulacion:inr' },
      { analyte: 'TPT', value: '29.5', unit: 's', refRange: '25-35', grupo: 'coagulacion', reportDate: '2026-07-10', sourceRef: 'stub:coagulacion:tpt' },
    ].map((l) => ({ ...l, extractionLayer: layer }));
    return { labs, perFile: files.map((f) => ({ file: f.filename, layer })) };
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
    /** Respuesta Sí/No normalizada ('sí'→'si'), o '' si no respondió. */
    const yesNo = (order: string): string =>
      (val(order) ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    /** ¿La respuesta Sí/No es afirmativa? */
    const isYes = (order: string): boolean => {
      const v = yesNo(order);
      return v === 'si' || v === 'true';
    };
    /**
     * ¿El paciente NEGÓ explícitamente? Distinto de "no respondió" (CS2): escribir
     * "Niega alergias" porque la pregunta quedó en blanco pone en un documento firmado una
     * negación que el paciente nunca hizo — y las alergias son justo lo que no se supone.
     */
    const isNo = (order: string): boolean => {
      const v = yesNo(order);
      return v === 'no' || v === 'false';
    };
    /** Negación atestada por el paciente; si no respondió, el campo queda sin reportar. */
    const negado = (order: string, texto: string, fuente: string): DocField =>
      isNo(order) ? { valor: texto, estado: 'ok', fuente } : { valor: null, estado: 'no_reportado', fuente: null };
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
      patologicos = negado('12', 'Niega antecedentes patológicos conocidos.', 'formulario:P12');
    }

    // Medicamentos: P14 ¿toma? → P15 ¿cuáles? si Sí.
    const medsDetalle = val('15');
    const medicamentos = isYes('14')
      ? ok(medsDetalle ? `Refiere ${medsDetalle.toLocaleLowerCase('es')}.` : 'Refiere consumo actual de medicamentos (sin especificar).', 'formulario:P14-15')
      : negado('14', 'Niega consumo de medicamentos.', 'formulario:P14');

    // Alergias: P16 ¿alérgico? → P17 ¿a qué? si Sí.
    const alergiaDetalle = val('17');
    const alergias = isYes('16')
      ? ok(alergiaDetalle ? `Refiere alergia a ${alergiaDetalle.toLocaleLowerCase('es')}.` : 'Refiere alergias medicamentosas o a otras sustancias (sin especificar).', 'formulario:P16-17')
      : negado('16', 'Niega alergias medicamentosas o a otras sustancias.', 'formulario:P16');

    // Cirugías previas (P18): si Sí y hay detalle (P19), traduce a término médico.
    const quirurgicos = isYes('18')
      ? (() => {
          const detalle = medicalTerm(val('19'));
          return detalle
            ? ok(`Refiere ${detalle.toLocaleLowerCase('es')}.`, 'formulario:P18-19')
            : ok('Refiere procedimientos quirúrgicos o anestésicos previos.', 'formulario:P18');
        })()
      : negado('18', 'Niega procedimientos quirúrgicos o anestésicos previos.', 'formulario:P18');

    const transfusionales = isYes('20')
      ? ok('Refiere transfusión sanguínea previa.', 'formulario:P20')
      : negado('20', 'Niega transfusiones previas.', 'formulario:P20');

    const protesis = isYes('21')
      ? ok('Refiere prótesis dental o diseño de sonrisa (relevante para el manejo de la vía aérea).', 'formulario:P21')
      : negado('21', 'Niega prótesis dental o diseño de sonrisa.', 'formulario:P21');

    // Hábitos: P22 tabaco/vapeo (+P23 cantidad), P24 alcohol, P25 psicoactivas.
    const habitos = ((): DocField => {
      const positivos: string[] = [];
      if (isYes('22')) {
        const cant = val('23');
        positivos.push(cant ? `tabaquismo/vapeo (${cant})` : 'tabaquismo/vapeo');
      }
      if (isYes('24')) positivos.push('consumo de alcohol');
      if (isYes('25')) positivos.push('consumo de sustancias psicoactivas');
      if (positivos.length > 0) return ok(`Refiere ${positivos.join(', ')}.`, 'formulario:P22-25');
      // Sólo se escribe la negación si el paciente negó las tres; si dejó alguna en blanco,
      // el campo queda sin reportar en vez de afirmar un "niega" que no dijo (CS2).
      const negóTodas = isNo('22') && isNo('24') && isNo('25');
      return negóTodas
        ? ok('Niega tabaquismo, vapeo, consumo de alcohol y sustancias psicoactivas.', 'formulario:P22-25')
        : noRep();
    })();

    // Condición actual: P12 pregunta si el paciente SUFRE una enfermedad, no si tiene
    // síntomas hoy. "No tengo enfermedad diagnosticada" no es "Asintomático" — afirmarlo
    // sería una observación clínica que nadie hizo (CS2). Sin enfermedad declarada se deja
    // sin reportar; lo determina el médico en el examen.
    const condicionActual: DocField = isYes('12') && val('13')
      ? derived(`En seguimiento por ${val('13')!.toLocaleLowerCase('es')}`, 'formulario:P12-13')
      : noRep();

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
        documento: ok(val('2') ? formatDocumentId(val('2')) : null, 'formulario:P2'),
        edad_sexo: edadSexo,
        peso_talla_imc: pesoTallaImc,
        procedimiento: ok(procedimiento, 'formulario:P9'),
        fecha_procedimiento: fechaProc,
        fecha_valoracion: noRep(), // la inyecta el renderer (opts.fechaValoracion)
        // CS2/CS4: el formulario NO pregunta por capacidad funcional (METs) ni por el
        // carácter de la cirugía. Afirmar "≥4 METs" es el umbral que exime de estudio
        // cardiológico adicional — asegurarlo sin haberlo evaluado no es derivar, es
        // inventar. Los pone el anestesiólogo en la revisión.
        capacidad_funcional: noRep(),
        tipo_cirugia: noRep(),
        condicion_actual: condicionActual,
        // Diagnóstico preoperatorio: nombre de la cirugía (término médico). El médico lo
        // reemplaza por el diagnóstico clínico real si aplica.
        diagnostico_preoperatorio: procedimiento ? derived(procedimiento) : noRep(),
        asa: asaField,
      },
      antecedentes: {
        patologicos,
        medicamentos,
        // GLP-1 solo se incluye si se declaró su uso (si no, la fila no aparece).
        ...(glp1
          ? { glp1: { valor: `Uso declarado de agonista GLP-1 (${input.glp1?.drug ?? 'no especificado'}).`, estado: 'ok' as const, fuente: 'derivado:IA', alerta: true } }
          : {}),
        alergias,
        quirurgicos,
        grupo_sanguineo: ok(val('11'), 'formulario:P11'),
        transfusionales,
        protesis_dental: protesis,
        habitos,
      },
      paraclinicos: {}, // los arma el código desde los labs extraídos (clinical.service)
      examen_fisico: {}, // el guardarraíl lo llena todo como pendiente_examen
      valoracion_plan: {
        concepto: {
          valor: (() => {
            // Cada frase debe sostenerse en un dato real. Nada de METs ni de "apto":
            // la capacidad funcional no se pregunta, y declarar apto a alguien sin
            // examinar es la conclusión que firma el médico, no el borrador (CS1/CS2).
            const partes: string[] = [];
            const edadTxt = edadStr ? `Paciente de ${edadStr}` : 'Paciente';
            partes.push(`${edadTxt} para valoración preanestésica.`);
            if (!isYes('12')) partes.push('No refiere comorbilidades sistémicas.');
            else if (val('13')) partes.push(`Antecedentes de ${val('13')!.toLocaleLowerCase('es')} a considerar en el manejo perioperatorio.`);
            if ((input.labs ?? []).some((l) => l.flag !== 'NORMAL')) partes.push('Hallazgos paraclínicos alterados a correlacionar (ver paraclínicos).');
            else if ((input.labs ?? []).length > 0) partes.push('Paraclínicos aportados dentro de los rangos reportados (ver detalle).');
            if (glp1) partes.push('Uso declarado de agonista GLP-1: manejar el riesgo de contenido gástrico residual (ver recomendaciones).');
            partes.push(
              `Riesgo anestésico sugerido ${asaField.valor}, a confirmar. Pendiente el examen físico presencial, ` +
                'la capacidad funcional y el concepto de aptitud, que corresponden al anestesiólogo.',
            );
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

/** Modelo del motor clínico cuando corre con la key (Opus para lo clínico). */
export const CLINICAL_MODEL = 'claude-opus-4-8';

/** Modelo de la extracción de labs por visión (Sonnet: leer tablas no necesita Opus). */
export const EXTRACTION_MODEL = 'claude-sonnet-5';

/**
 * Punto ÚNICO de cambio entre el stub y Claude. `AI_PROVIDER=anthropic` + ANTHROPIC_API_KEY
 * activa la lectura real de exámenes y el motor clínico; todo lo demás del sistema no cambia.
 */
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? 'stub';
  switch (provider) {
    case 'anthropic': {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('AI_PROVIDER=anthropic requiere ANTHROPIC_API_KEY en el entorno.');
      }
      // Carga diferida: el SDK sólo se importa cuando de verdad se usa.
      const { AnthropicAIProvider } = require('./anthropic') as typeof import('./anthropic');
      return new AnthropicAIProvider();
    }
    case 'stub':
    default:
      return new StubAIProvider();
  }
}

/** Modelo/etiqueta del proveedor activo, para trazabilidad en el assessment. */
export function activeModelLabel(): string {
  return (process.env.AI_PROVIDER ?? 'stub') === 'anthropic' ? CLINICAL_MODEL : 'stub';
}
