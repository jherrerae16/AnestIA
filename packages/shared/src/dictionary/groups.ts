/**
 * Antecedentes patológicos agrupados (Especificación §5, páginas 6-7).
 *
 * Cada grupo es UNA pregunta de tipo `ACORDEON_MULTIPLE`, no una pregunta por enfermedad. Con
 * ~74 opciones, modelarlas como preguntas individuales infla el espacio de claves y ensancha el
 * punto fijo de visibilidad en decenas de nodos por grupo, sin ganar nada: la spec las describe
 * como "acordeones cerrados; el paciente abre solo el grupo que reconoce".
 *
 * El `slug` es load-bearing: es la clave de instancia del repetidor `AP01`
 * (`AP01#hipertension_arterial` = "¿está controlada esa enfermedad?").
 */

export interface OpcionPatologia {
  /** Clave estable de instancia. No cambia aunque se reescriba la etiqueta. */
  slug: string;
  /** Texto exacto que ve el paciente. */
  label: string;
  /**
   * Alimenta directamente una variable de escala o una alerta. Se usa para saber qué preguntas
   * aclaratorias abrir y qué escalas se activan; nunca para diagnosticar.
   */
  alimenta?: readonly string[];
}

export interface GrupoPatologias {
  key: string;
  label: string;
  opciones: readonly OpcionPatologia[];
}

export const GRUPOS_PATOLOGIAS: readonly GrupoPatologias[] = [
  {
    key: 'cardiovascular',
    label: 'Corazón y circulación',
    opciones: [
      { slug: 'hipertension_arterial', label: 'Hipertensión arterial', alimenta: ['STOP_BANG'] },
      { slug: 'enfermedad_coronaria', label: 'Enfermedad coronaria o angina', alimenta: ['RCRI'] },
      { slug: 'infarto_miocardio', label: 'Infarto de miocardio', alimenta: ['RCRI', 'CAPRINI'] },
      { slug: 'insuficiencia_cardiaca', label: 'Insuficiencia cardíaca', alimenta: ['RCRI', 'CAPRINI'] },
      { slug: 'arritmia', label: 'Arritmia' },
      { slug: 'enfermedad_valvular', label: 'Enfermedad valvular' },
      { slug: 'cardiomiopatia', label: 'Cardiomiopatía' },
      { slug: 'cardiopatia_congenita', label: 'Cardiopatía congénita' },
      { slug: 'marcapasos_desfibrilador', label: 'Marcapasos o desfibrilador' },
      { slug: 'hipertension_pulmonar', label: 'Hipertensión pulmonar' },
      { slug: 'acv_ait', label: 'Accidente cerebrovascular o isquemia transitoria', alimenta: ['RCRI'] },
      { slug: 'enfermedad_vascular_periferica', label: 'Enfermedad vascular periférica' },
    ],
  },
  {
    key: 'respiratorio',
    label: 'Respiración y pulmones',
    opciones: [
      { slug: 'asma', label: 'Asma' },
      { slug: 'epoc', label: 'EPOC, enfisema o bronquitis crónica', alimenta: ['CAPRINI'] },
      { slug: 'apnea_sueno', label: 'Apnea del sueño', alimenta: ['STOP_BANG'] },
      { slug: 'uso_cpap', label: 'Uso de CPAP' },
      { slug: 'oxigeno_domiciliario', label: 'Oxígeno domiciliario' },
      { slug: 'enfermedad_intersticial', label: 'Enfermedad pulmonar intersticial' },
      { slug: 'tuberculosis', label: 'Tuberculosis' },
      { slug: 'otra_pulmonar', label: 'Otra enfermedad pulmonar' },
    ],
  },
  {
    key: 'endocrino_metabolico',
    label: 'Hormonas y metabolismo',
    opciones: [
      { slug: 'diabetes_tipo_1', label: 'Diabetes tipo 1' },
      { slug: 'diabetes_tipo_2', label: 'Diabetes tipo 2' },
      { slug: 'uso_insulina', label: 'Uso de insulina', alimenta: ['RCRI'] },
      { slug: 'hipotiroidismo', label: 'Hipotiroidismo' },
      { slug: 'hipertiroidismo', label: 'Hipertiroidismo' },
      { slug: 'enfermedad_suprarrenal', label: 'Enfermedad suprarrenal' },
      { slug: 'obesidad_tratada', label: 'Obesidad tratada médicamente' },
    ],
  },
  {
    key: 'renal_hepatico',
    label: 'Riñones e hígado',
    opciones: [
      { slug: 'insuficiencia_renal_cronica', label: 'Insuficiencia renal crónica' },
      { slug: 'dialisis', label: 'Diálisis' },
      { slug: 'litiasis_renal', label: 'Cálculos en el riñón' },
      { slug: 'itu_recurrente', label: 'Infecciones urinarias frecuentes' },
      { slug: 'hepatitis', label: 'Hepatitis' },
      { slug: 'cirrosis', label: 'Cirrosis' },
      { slug: 'otra_hepatica', label: 'Otra enfermedad del hígado' },
    ],
  },
  {
    key: 'hematologico',
    label: 'Sangre y coagulación',
    opciones: [
      { slug: 'anemia', label: 'Anemia' },
      { slug: 'trastorno_coagulacion', label: 'Trastorno de coagulación o sangrado' },
      { slug: 'tvp_tep', label: 'Trombosis venosa o embolia pulmonar', alimenta: ['CAPRINI'] },
      { slug: 'trombofilia', label: 'Trombofilia', alimenta: ['CAPRINI'] },
      { slug: 'enfermedad_falciforme', label: 'Enfermedad falciforme' },
      { slug: 'otra_sangre', label: 'Otra enfermedad de la sangre' },
    ],
  },
  {
    key: 'neurologico',
    label: 'Sistema nervioso',
    opciones: [
      { slug: 'epilepsia', label: 'Epilepsia o convulsiones' },
      { slug: 'enfermedad_neuromuscular', label: 'Enfermedad neuromuscular' },
      { slug: 'parkinson', label: 'Parkinson' },
      { slug: 'demencia', label: 'Demencia o deterioro cognitivo', alimenta: ['FRAIL'] },
      { slug: 'migrana', label: 'Migraña' },
      { slug: 'paralisis_lesion_medular', label: 'Parálisis o lesión de la médula', alimenta: ['CAPRINI'] },
      { slug: 'otra_neurologica', label: 'Otra enfermedad neurológica' },
    ],
  },
  {
    key: 'digestivo',
    label: 'Digestión',
    opciones: [
      { slug: 'reflujo', label: 'Reflujo gastroesofágico' },
      { slug: 'gastritis_ulcera', label: 'Gastritis o úlcera' },
      { slug: 'gastroparesia', label: 'Gastroparesia' },
      { slug: 'eii', label: 'Enfermedad inflamatoria intestinal', alimenta: ['CAPRINI'] },
      { slug: 'obstruccion_digestiva', label: 'Obstrucción digestiva previa' },
      { slug: 'otra_digestiva', label: 'Otra enfermedad digestiva' },
    ],
  },
  {
    key: 'oncologico_inmune',
    label: 'Cáncer y defensas',
    opciones: [
      { slug: 'cancer_activo', label: 'Cáncer activo', alimenta: ['CAPRINI'] },
      { slug: 'quimioterapia', label: 'Quimioterapia', alimenta: ['CAPRINI'] },
      { slug: 'radioterapia', label: 'Radioterapia' },
      { slug: 'enfermedad_autoinmune', label: 'Enfermedad autoinmune' },
      { slug: 'inmunosupresion', label: 'Inmunosupresión' },
      { slug: 'trasplante', label: 'Trasplante' },
    ],
  },
  {
    key: 'musculoesqueletico',
    label: 'Huesos, músculos y articulaciones',
    opciones: [
      { slug: 'artritis', label: 'Artritis o enfermedad de las articulaciones' },
      { slug: 'limitacion_cervical', label: 'Limitación para mover el cuello' },
      { slug: 'protesis_articular', label: 'Prótesis en una articulación' },
      { slug: 'osteoporosis', label: 'Osteoporosis' },
      { slug: 'dolor_cronico', label: 'Dolor crónico' },
      { slug: 'otra_musculoesqueletica', label: 'Otra enfermedad de huesos o articulaciones' },
    ],
  },
  {
    key: 'psiquiatrico',
    label: 'Salud mental',
    opciones: [
      { slug: 'ansiedad', label: 'Ansiedad' },
      { slug: 'depresion', label: 'Depresión' },
      { slug: 'trastorno_bipolar', label: 'Trastorno bipolar' },
      { slug: 'esquizofrenia', label: 'Esquizofrenia' },
      { slug: 'otro_psiquiatrico', label: 'Otro trastorno de salud mental' },
    ],
  },
  {
    key: 'otras',
    label: 'Otras condiciones',
    opciones: [
      { slug: 'infeccion_activa', label: 'Infección activa' },
      { slug: 'hospitalizacion_reciente', label: 'Hospitalización reciente' },
      { slug: 'enfermedad_no_incluida', label: 'Una enfermedad que no está en la lista' },
      { slug: 'no_sabe_diagnostico', label: 'No sé cuál es el diagnóstico' },
    ],
  },
] as const;

/**
 * Opciones de cierre que la spec exige al final de cada grupo. "Ninguna" es EXCLUYENTE: al
 * marcarla se desmarca todo lo demás, y la exclusividad se valida también en el servidor —
 * una carga con `["Ninguna","Hipertensión"]` calcularía una escala sobre una contradicción.
 */
export const OPCION_NINGUNA = 'Ninguna de las anteriores';
export const OPCION_OTRA = 'Otra';
export const OPCION_NO_SABE = 'No sabe';
export const OPCIONES_CIERRE = [OPCION_NINGUNA, OPCION_OTRA, OPCION_NO_SABE] as const;

/** Todas las opciones de un grupo, con las de cierre al final. */
export function opcionesDeGrupo(g: GrupoPatologias): string[] {
  return [...g.opciones.map((o) => o.label), ...OPCIONES_CIERRE];
}

/** Índice slug → opción, para resolver claves de instancia `AP01#<slug>`. */
export const PATOLOGIA_POR_SLUG: ReadonlyMap<string, OpcionPatologia> = new Map(
  GRUPOS_PATOLOGIAS.flatMap((g) => g.opciones.map((o) => [o.slug, o] as const)),
);

/** Índice etiqueta normalizada → slug, para mapear lo que respondió el paciente. */
export const SLUG_POR_LABEL: ReadonlyMap<string, string> = new Map(
  GRUPOS_PATOLOGIAS.flatMap((g) =>
    g.opciones.map((o) => [o.label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), o.slug] as const),
  ),
);
