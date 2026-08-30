import {
  CODES,
  CODIGOS_ACORDEON,
  noControladas,
  formatDocumentId,
  medicalTerm,
  parseNumeric,
  suggestASA,
  type DocField,
  type DocumentJSON,
  type FormAnswers,
} from '@anestia/shared';

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
  /**
   * Id del `Attachment`. Lo inyecta el adaptador, NUNCA se le pide al modelo: el modelo no puede
   * conocerlo. Sin él, un valor de laboratorio no se puede rastrear al PDF que lo produjo, que
   * es lo que la Especificación §15 exige.
   */
  attachmentId?: string;
}

export interface ExtractedLab {
  analyte: string;
  /** Nombre tal como está impreso en el informe. Se conserva junto al canónico. */
  analyteRaw?: string | null;
  value: string;
  /** Valor tal como está impreso, antes de normalizar. */
  valueRaw?: string | null;
  unit?: string | null;
  refRange?: string | null;
  /** Tipo de estudio leído del informe (hemograma, coagulación…). Lo asigna el extractor. */
  grupo?: string | null;
  /** Página del informe donde se leyó el valor (1-based). */
  page?: number | null;
  /** Confianza de la lectura, 0-1. Por debajo del umbral pasa a revisión humana. */
  confidence?: number | null;
  /** Institución que emite el informe, si aparece. */
  institucion?: string | null;
  /** Id del archivo del que salió. Lo pone el adaptador, no el modelo. */
  attachmentId?: string | null;
  /** Identidad impresa en la cabecera del informe, para comprobar de quién es. */
  pacienteNombre?: string | null;
  pacienteDocumento?: string | null;
  /** Fecha de TOMA de la muestra, distinta de la de emisión (`reportDate`). */
  collectedAt?: string | null;
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

/**
 * Informe diagnóstico no-laboratorio leído de un adjunto (ECG, ecocardiograma, radiografía,
 * espirometría). Especificación §16: se transcribe ritmo, frecuencia, intervalos y conclusión;
 * la interpretación es clínica y NINGUNA escala se autocalcula con esto.
 */
export interface ExtractedEstudio {
  /** Tipo canónico. El adaptador lo normaliza; el modelo puede devolver el nombre impreso. */
  tipo?: string | null;
  tipoRaw?: string | null;
  ritmo?: string | null;
  frecuencia?: string | null;
  intervalos?: string | null;
  conclusion?: string | null;
  hallazgos?: string | null;
  institucion?: string | null;
  collectedAt?: string | null;
  reportDate?: string | null;
  page?: number | null;
  confidence?: number | null;
  pacienteNombre?: string | null;
  pacienteDocumento?: string | null;
  attachmentId?: string | null;
  sourceRef?: string | null;
  extractionLayer?: 'texto' | 'vision';
}

/** Resultado de extractLabs: los labs + cómo se resolvió cada archivo. */
export interface ExtractLabsResult {
  labs: ExtractedLab[];
  /**
   * Informes no-laboratorio del mismo barrido. Van aparte de `labs` porque no son
   * analito/valor/rango y porque no pueden alimentar escalas (§16).
   */
  estudios?: ExtractedEstudio[];
  perFile: FileExtractionInfo[];
}

export interface ClinicalInput {
  caseId: string;
  answers: Record<string, { value: unknown; type: string }>;
  labs: FlaggedLab[];
  glp1?: { declared: boolean; drug?: string; lastDose?: string };
  imc?: number | null;
  /** Peso/talla reales del paciente (ID10/ID11) — fuerzan peso_talla_imc por código (CS2). */
  pesoKg?: number | null;
  tallaCm?: number | null;
  /** Edad en años (ID03 contra la fecha del procedimiento). */
  edad?: number | null;
  /**
   * Datos de la AGENDA quirúrgica (`PX01`, `PX03`). No salen del formulario: la Especificación
   * es explícita en que el paciente no describe el acto quirúrgico.
   */
  procedimiento?: string | null;
  /** PX02 — el diagnóstico preoperatorio lo aporta la programación, no el paciente. */
  diagnosticoPreop?: string | null;
  fechaProcedimiento?: string | null;
}

export interface AIProvider {
  extractLabs(files: FileRef[], method?: ExtractionMethod): Promise<ExtractLabsResult>;
  generateAssessment(input: ClinicalInput): Promise<DocumentJSON>;
}

/** Stub: valores de ejemplo del Anexo C. Sólo para desarrollo sin key. */
export class StubAIProvider implements AIProvider {
  async extractLabs(files: FileRef[], method: ExtractionMethod = 'capas'): Promise<ExtractLabsResult> {
    // El stub NO lee archivos y NUNCA fabrica resultados de laboratorio (CS2). Aunque haya
    // adjuntos, no puede inventar valores para el paciente real: devuelve labs vacíos. El caso
    // de referencia (Anexo C, Uribe) vive como fixture de test explícito, no aquí — un
    // documento firmado jamás debe llevar labs que nadie extrajo del examen del paciente.
    const layer = method === 'vision' ? 'vision' : ('texto' as const);
    return { labs: [], perFile: (files ?? []).map((f) => ({ file: f.filename, layer })) };
  }

  async generateAssessment(input: ClinicalInput): Promise<DocumentJSON> {
    // Stub: documento construido SÓLO con datos reales del formulario del Dr. Luquetta.
    // Redacción clínica profesional para respuestas Sí/No. Examen físico = pendiente (CS3).
    // Mapeo real (ver docs/form-mapping.md y prisma/seed.ts — NO cambiar sin cotejar ahí):
    // Las respuestas se leen por CÓDIGO de la especificación (ver `CODES`), no por posición.
    // Peso = ID10 y talla = ID11: de ahí sale peso_talla_imc, y leer la pregunta equivocada
    // fabrica cifras en un documento firmado.
    const a = input.answers ?? {};
    const val = (code: string): string | null => {
      const v = a[code]?.value;
      if (v == null || v === '') return null;
      return Array.isArray(v) ? v.join(', ') : String(v);
    };
    /** Respuesta Sí/No normalizada ('sí'→'si'), o '' si no respondió. */
    const yesNo = (code: string): string =>
      (val(code) ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    /** ¿La respuesta Sí/No es afirmativa? */
    const isYes = (code: string): boolean => {
      const v = yesNo(code);
      return v === 'si' || v === 'true';
    };
    /**
     * ¿El paciente NEGÓ explícitamente? Distinto de "no respondió" (CS2): escribir
     * "Niega alergias" porque la pregunta quedó en blanco pone en un documento firmado una
     * negación que el paciente nunca hizo — y las alergias son justo lo que no se supone.
     */
    const isNo = (code: string): boolean => {
      const v = yesNo(code);
      return v === 'no' || v === 'false';
    };
    /** Negación atestada por el paciente; si no respondió, el campo queda sin reportar. */
    const negado = (code: string, texto: string, fuente: string): DocField =>
      isNo(code) ? { valor: texto, estado: 'ok', fuente } : { valor: null, estado: 'no_reportado', fuente: null };
    /**
     * Patologías declaradas: la unión de los 11 acordeones de antecedentes. Antes era una sola
     * pregunta plana (P13); la Especificación las agrupa por sistema. Se descartan las opciones
     * de cierre ("Ninguna de las anteriores", "No sabe") — no son diagnósticos.
     */
    /** Filas de un repetidor en prosa legible ('Losartán 50 mg, cada 12 h · Metformina'). */
    const repetidorEnProsa = (code: string): string | null => {
      const v = a[code]?.value;
      if (!Array.isArray(v) || v.length === 0) return null;
      const filas = v.map((raw) => {
        let o: Record<string, unknown> = {};
        try { const p: unknown = JSON.parse(raw); if (p && typeof p === 'object') o = p as Record<string, unknown>; }
        catch { return String(raw).trim(); }
        const { nombre, ...resto } = o;
        const det = Object.values(resto).map((x) => String(x ?? '').trim()).filter(Boolean);
        return [String(nombre ?? '').trim(), det.join(', ')].filter(Boolean).join(' ');
      }).filter(Boolean);
      return filas.length ? filas.join(' · ') : null;
    };

    const patologias = (): string | null => {
      const todas = CODIGOS_ACORDEON.flatMap((c: string) => {
        const v = a[c]?.value;
        return Array.isArray(v) ? v : v ? [String(v)] : [];
      }).filter((o: string) => !/^(ninguna de las anteriores|ninguno|ninguna|no sabe)$/i.test(o.trim()));
      return todas.length > 0 ? todas.join(', ') : null;
    };
    const ok = (valor: string | null, fuente: string): DocField =>
      valor != null ? { valor, estado: 'ok', fuente } : { valor: null, estado: 'no_reportado', fuente: null };
    const derived = (valor: string, fuente = 'derivado:IA'): DocField => ({ valor, estado: 'ok', fuente });
    const noRep = (): DocField => ({ valor: null, estado: 'no_reportado', fuente: null });
    /** Capitaliza la primera letra. */
    const sentence = (s: string | null): string | null =>
      s ? s.charAt(0).toLocaleUpperCase('es') + s.slice(1) : s;

    // Procedimiento: viene de la AGENDA (PX01), no del paciente. Traduce lenguaje coloquial →
    // término médico ('lipo' → 'Liposucción').
    const procedimiento = medicalTerm(input.procedimiento ?? null);

    // --- Edad (derivada de P3 nacimiento vs P10 fecha de cirugía; sin Date.now) ---
    let edadStr: string | null = null;
    const birth = val(CODES.fechaNacimiento);
    if (birth) {
      const d = new Date(birth);
      const refRaw = input.fechaProcedimiento ?? null;
      const ref = refRaw ? new Date(refRaw) : null;
      if (!isNaN(d.getTime()) && ref && !isNaN(ref.getTime())) {
        let age = ref.getFullYear() - d.getFullYear();
        const m = ref.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
        if (age >= 0 && age < 130) edadStr = `${age} años`;
      }
    }
    // Sexo: normaliza Hombre→Masculino, Mujer→Femenino (tono clínico).
    const sexoRaw = (val(CODES.sexoNacimiento) ?? '').toLowerCase();
    const sexo = /^(hombre|masc|m$)/.test(sexoRaw) ? 'Masculino'
      : /^(mujer|feme|f$)/.test(sexoRaw) ? 'Femenino'
      : val(CODES.sexoNacimiento) ? sentence(val(CODES.sexoNacimiento)) : null;
    let edadSexo: DocField;
    // El sexo viene VERBATIM de P4 (no es derivado); la edad SÍ se deriva de P3 vs P10. La
    // fuente lo refleja: compuesta cuando hay ambos, para no marcar como IA un dato del paciente.
    if (edadStr && sexo) edadSexo = { valor: `${edadStr} / ${sexo}`, estado: 'ok', fuente: 'formulario:ID04; derivado:IA (edad de ID03 y agenda:PX03)' };
    else if (edadStr) edadSexo = derived(edadStr);
    else if (sexo) edadSexo = ok(sexo, 'formulario:ID04');
    else edadSexo = noRep();

    // --- Peso / Talla / IMC (P5 kg, P6 cm) → combinado + IMC calculado ---
    // parseNumeric normaliza la coma decimal en AMBOS (antes el peso salía verbatim con coma).
    // Nota: enforceGuardrails vuelve a forzar este campo desde los datos reales; el stub lo
    // arma bien igual para ser coherente con lo que persiste.
    const pesoNum = parseNumeric(val(CODES.peso) ?? '');
    const tallaNum = parseNumeric(val(CODES.talla) ?? '');
    let pesoTallaImc: DocField = noRep();
    if (pesoNum != null && tallaNum != null) {
      const metros = tallaNum > 3 ? tallaNum / 100 : tallaNum;
      const imcStr = input.imc != null ? ` / ${input.imc.toFixed(1)} kg/m²` : '';
      pesoTallaImc = derived(`${pesoNum} kg / ${metros.toFixed(2)} m${imcStr}`, input.imc != null ? 'derivado:IA' : 'formulario:ID10, ID11');
    }

    // --- Fecha del procedimiento (P10) → formato dd-mm-aaaa ---
    const fechaProc = ((): DocField => {
      const raw = (input.fechaProcedimiento ?? null);
      if (!raw) return noRep();
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return ok(m ? `${m[3]}-${m[2]}-${m[1]}` : raw, 'agenda:PX03');
    })();

    // ── ANTECEDENTES: redacción clínica desde Sí/No ──
    // Patológicos: P12 ¿enfermedad? → P13 patologías (multi) si Sí.
    let patologicos: DocField;
    if (isYes(CODES.tieneEnfermedad)) {
      const lista = patologias();
      patologicos = lista
        ? ok(`Refiere ${lista.toLocaleLowerCase('es')}.`, 'formulario:AP00, AG01-AG11')
        : ok('Refiere antecedentes patológicos (sin especificar).', 'formulario:AP00');
    } else {
      patologicos = negado(CODES.tieneEnfermedad, 'Niega antecedentes patológicos conocidos.', 'formulario:AP00');
    }

    // Medicamentos: P14 ¿toma? → P15 ¿cuáles? si Sí.
    // Los medicamentos son un REPETIDOR: se formatean a prosa. Sin esto el documento firmado
    // mostraría el JSON crudo de cada fila.
    const medsDetalle = repetidorEnProsa(CODES.listaMedicamentos) || val(CODES.listaMedicamentos);
    const medicamentos = isYes(CODES.tomaMedicamentos)
      ? ok(medsDetalle ? `Refiere ${medsDetalle.toLocaleLowerCase('es')}.` : 'Refiere consumo actual de medicamentos (sin especificar).', 'formulario:RX01, RX02')
      : negado(CODES.tomaMedicamentos, 'Niega consumo de medicamentos.', 'formulario:RX01');

    // Alergias: P16 ¿alérgico? → P17 ¿a qué? si Sí.
    const alergiaDetalle = val(CODES.aQueEsAlergico);
    const alergias = isYes(CODES.esAlergico)
      ? ok(alergiaDetalle ? `Refiere alergia a ${alergiaDetalle.toLocaleLowerCase('es')}.` : 'Refiere alergias medicamentosas o a otras sustancias (sin especificar).', 'formulario:AL01, AL02')
      : negado(CODES.esAlergico, 'Niega alergias medicamentosas o a otras sustancias.', 'formulario:AL01');

    // Cirugías previas (P18): si Sí y hay detalle (P19), traduce a término médico.
    const quirurgicos = isYes(CODES.anestesiaPrevia)
      ? (() => {
          const detalle = medicalTerm(val(CODES.cualesCirugias));
          return detalle
            ? ok(`Refiere ${detalle.toLocaleLowerCase('es')}.`, 'formulario:AN01, AN02')
            : ok('Refiere procedimientos quirúrgicos o anestésicos previos.', 'formulario:AN01');
        })()
      : negado(CODES.anestesiaPrevia, 'Niega procedimientos quirúrgicos o anestésicos previos.', 'formulario:AN01');

    const transfusionales = isYes(CODES.transfusionPrevia)
      ? ok('Refiere transfusión sanguínea previa.', 'formulario:TR01')
      : negado(CODES.transfusionPrevia, 'Niega transfusiones previas.', 'formulario:TR01');

    // DE01 pasó de sí/no a multiselección ("Prótesis removible", …, "Ninguno").
    const dentadura = val(CODES.protesisDental);
    const dentaduraNegada = /^ninguno$/i.test((dentadura ?? '').trim());
    const protesis = dentadura && !dentaduraNegada
      ? ok(`Refiere ${val(CODES.protesisDental)!.toLocaleLowerCase('es')} (relevante para el manejo de la vía aérea).`, 'formulario:DE01')
      : dentaduraNegada
        ? ok('Niega prótesis dental, implantes o dientes flojos.', 'formulario:DE01')
        : noRep();

    // Hábitos: P22 tabaco/vapeo (+P23 cantidad), P24 alcohol (+P25 frecuencia), P26 psicoactivas (+P27 cuáles).
    const habitos = ((): DocField => {
      // Los tres hábitos dejaron de ser sí/no: la Especificación §8 los pide con escalas
      // propias (tabaco: nunca/exfumador/cigarrillo/vapeador; alcohol: frecuencia mensual;
      // psicoactivas: multiselección). "Nunca" es una negación declarada; un blanco NO lo es.
      const tabacoV = val(CODES.tabaco);
      const alcoholV = val(CODES.alcohol);
      const psicoV = val(CODES.psicoactivas);
      const esNegativo = (v: string | null, negativos: string[]) =>
        v != null && negativos.includes(v.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));

      const positivos: string[] = [];
      if (tabacoV && !esNegativo(tabacoV, ['nunca'])) {
        const cant = val(CODES.cigarrillosDia) ?? val(CODES.vapeoDia);
        positivos.push(cant ? `${tabacoV.toLocaleLowerCase('es')} (${cant} al día)` : tabacoV.toLocaleLowerCase('es'));
      }
      if (alcoholV && !esNegativo(alcoholV, ['nunca'])) {
        positivos.push(`consumo de alcohol (${alcoholV.toLocaleLowerCase('es')})`);
      }
      if (psicoV && !esNegativo(psicoV, ['no'])) {
        positivos.push(`consumo de sustancias psicoactivas (${psicoV.toLocaleLowerCase('es')})`);
      }
      if (positivos.length > 0) return ok(`Refiere ${positivos.join(', ')}.`, 'formulario:HB01-HB07');

      // Sólo se escribe la negación si el paciente negó los tres. Si dejó alguno en blanco, el
      // campo queda sin reportar en vez de afirmar un "niega" que nunca dijo (CS2).
      const negoTodas =
        esNegativo(tabacoV, ['nunca']) && esNegativo(alcoholV, ['nunca']) && esNegativo(psicoV, ['no']);
      return negoTodas
        ? ok('Niega tabaquismo, vapeo, consumo de alcohol y sustancias psicoactivas.', 'formulario:HB01-HB07')
        : noRep();
    })();

    // Condición actual: P12 pregunta si el paciente SUFRE una enfermedad, no si tiene
    // síntomas hoy. "No tengo enfermedad diagnosticada" no es "Asintomático" — afirmarlo
    // sería una observación clínica que nadie hizo (CS2). Sin enfermedad declarada se deja
    // sin reportar; lo determina el médico en el examen.
    // Condición actual: distingue lo controlado de lo que no. Antes decía "En seguimiento por X"
    // para todo por igual; la Especificación §5 pregunta el control por CADA enfermedad, y una
    // diabetes no controlada no es lo mismo que una hipertensión controlada para el ASA.
    const sinControl = noControladas(input.answers as FormAnswers).map((i) => i.label);
    const condicionActual: DocField = isYes(CODES.tieneEnfermedad) && patologias()
      ? derived(
          sinControl.length > 0
            ? `En seguimiento por ${patologias()!.toLocaleLowerCase('es')}. ` +
              `Sin control declarado: ${sinControl.join(', ').toLocaleLowerCase('es')}.`
            : `En seguimiento por ${patologias()!.toLocaleLowerCase('es')}`,
          'formulario:AP00, AG01-AG11, AP01',
        )
      : noRep();

    // ASA: sugerido desde comorbilidades declaradas (P13 patologías). Marcado como derivado
    // para que el anestesiólogo lo confirme (CS4).
    const comorbilidades = isYes(CODES.tieneEnfermedad) && patologias() ? patologias()!.split(',').map((s) => s.trim()) : [];
    const asaSug = suggestASA(comorbilidades);
    const asaField: DocField = { valor: `ASA ${asaSug.grado}`, estado: 'ok', fuente: 'derivado:IA', nota: asaSug.justificacion };

    // Capacidad funcional: queda SIN REPORTAR hasta que exista la escala.
    //
    // Antes se afirmaba "≥ 4 METs" con estado `ok` cuando el paciente respondía que NO sufría
    // ninguna enfermedad. Eso es una invención: la ausencia de comorbilidad declarada no mide
    // la tolerancia al ejercicio de nadie, y al salir en estado `ok` el valor no bloqueaba la
    // aprobación y llegaba tal cual al PDF firmado.
    //
    // La Especificación §9 define cómo se obtiene de verdad: CF01 y CF02 ambas afirmativas, sin
    // síntomas cardiovasculares y con cirugía de bajo riesgo; en cualquier otro caso se abre el
    // DASI completo (D01-D12). Eso llega con el motor de escalas (Fase 3) y entonces este campo
    // se poblará desde el resultado de DASI con `fuente: 'escala:DASI@1'`.
    const capacidadFuncional: DocField = noRep();

    const glp1 = input.glp1?.declared;
    const recomendaciones = glp1
      ? 'Ayuno de 8 horas; dieta líquida durante las 24 horas previas; confirmar ausencia de náuseas, vómito, distensión o dolor abdominal. Ante uso de agonista GLP-1, considerar ecografía gástrica y manejar como estómago lleno o diferir el procedimiento si existe riesgo de contenido gástrico residual.'
      : 'Ayuno según protocolo institucional; confirmar condiciones del paciente el día del procedimiento.';

    return {
      identificacion: {
        paciente: ok(val(CODES.nombre), 'formulario:ID01'),
        documento: ok(val(CODES.documento) ? formatDocumentId(val(CODES.documento)) : null, 'formulario:ID02'),
        edad_sexo: edadSexo,
        peso_talla_imc: pesoTallaImc,
        procedimiento: ok(procedimiento, 'agenda:PX01'),
        fecha_procedimiento: fechaProc,
        fecha_valoracion: noRep(), // la inyecta el renderer (opts.fechaValoracion)
        // CS2/CS4: el formulario NO pregunta por capacidad funcional (METs) ni por el
        // capacidad_funcional: estimado editable si no hay comorbilidades (ver arriba), a
        // confirmar por el anestesiólogo (CS4). Con comorbilidad → no_reportado.
        capacidad_funcional: capacidadFuncional,
        condicion_actual: condicionActual,
        // Diagnóstico preoperatorio: nombre de la cirugía (término médico). El médico lo
        // reemplaza por el diagnóstico clínico real si aplica.
        // El diagnóstico preoperatorio lo aporta la AGENDA (PX02). Sólo si falta se deriva del
        // procedimiento, y entonces va marcado como derivado para que el médico lo confirme.
        diagnostico_preoperatorio: input.diagnosticoPreop
          ? ok(input.diagnosticoPreop, 'agenda:PX02')
          : procedimiento ? derived(procedimiento) : noRep(),
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
        grupo_sanguineo: ok(val(CODES.grupoSanguineo), 'formulario:ID09'),
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
            if (!isYes(CODES.tieneEnfermedad)) partes.push('No refiere comorbilidades sistémicas.');
            else if (patologias()) partes.push(`Antecedentes de ${patologias()!.toLocaleLowerCase('es')} a considerar en el manejo perioperatorio.`);
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
  // Fail-closed: en producción, AI_PROVIDER debe estar seteado explícitamente. Caer al stub por
  // una env ausente/mal escrita produciría documentos con el motor de ejemplo sin que nadie lo
  // note (CS2/CS5). En dev sí se permite el default 'stub' para trabajar sin key.
  const raw = process.env.AI_PROVIDER;
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error('AI_PROVIDER no está definido en producción. Setéalo a "anthropic" (o "stub" explícito en dev).');
  }
  const provider = raw ?? 'stub';
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
      return new StubAIProvider();
    default:
      throw new Error(`AI_PROVIDER="${provider}" no reconocido. Usa "anthropic" o "stub".`);
  }
}

/** Modelo/etiqueta del proveedor activo, para trazabilidad en el assessment. */
export function activeModelLabel(): string {
  return (process.env.AI_PROVIDER ?? 'stub') === 'anthropic' ? CLINICAL_MODEL : 'stub';
}
