import type { Rule } from '../rules';
import { GRUPOS_PATOLOGIAS, opcionesDeGrupo } from './groups';
import type { DictQuestion } from './types';

/**
 * Diccionario de preguntas — Especificación de Datos Mínimos del Dr. Luquetta.
 *
 * El texto de cada `label` es el de la spec, palabra por palabra. Los `code` son load-bearing:
 * el motor clínico cita `formulario:CF01`, así que renombrar un código rompe la trazabilidad de
 * todo documento que lo referencie. El `order` es solo presentación.
 */

// ── Azúcar para las reglas de activación ──────────────────────────────────────────────────
const si = (code: string): Rule => ({ kind: 'answer', code, op: 'equals', value: 'si' });
const respondida = (code: string): Rule => ({ kind: 'answer', code, op: 'answered' });
const incluye = (code: string, value: string | string[]): Rule => ({
  kind: 'answer',
  code,
  op: 'includes',
  value,
});
const enLista = (code: string, value: string[]): Rule => ({ kind: 'answer', code, op: 'in', value });
/**
 * "Respondió algo que NO está en esta lista".
 *
 * Se usa el operador negativo en vez de envolver `in` en un `not`: una pregunta SIN RESPONDER
 * hace falsa la comparación, y el `not` la volvería verdadera, así que la rama se abriría antes
 * de que el paciente conteste. Con `notIn`, la ausencia resuelve a falso, que es lo correcto.
 */
const noEnLista = (code: string, value: string[]): Rule => ({ kind: 'answer', code, op: 'notIn', value });
const todo = (...rules: Rule[]): Rule => ({ kind: 'all', rules });
const alguna = (...rules: Rule[]): Rule => ({ kind: 'any', rules });
type FactRule = Extract<Rule, { kind: 'fact' }>;
const hecho = (
  fact: FactRule['fact'],
  op: FactRule['op'],
  value?: string | number | boolean | string[],
): Rule => ({ kind: 'fact', fact, op, value });

const SI_NO_NS = ['Sí', 'No', 'No sabe'] as const;

/** Adulto = ruta adulta o adulto mayor. Las pediátricas usan el módulo `PD`. */
const ES_ADULTO: Rule = hecho('ruta', 'in', ['ADULTO', 'ADULTO_MAYOR']);
const ES_PEDIATRICO: Rule = hecho('ruta', 'equals', 'PEDIATRICA');

let n = 0;
const ord = () => ++n;

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3. Identificación y datos generales (Especificación §3)
// ═════════════════════════════════════════════════════════════════════════════════════════

const IDENTIFICACION: DictQuestion[] = [
  {
    code: 'ID01', order: ord(), label: 'Nombre completo',
    type: 'TEXTO_CORTO', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    ayuda: 'Como aparece en su documento de identidad.',
  },
  {
    code: 'ID02', order: ord(), label: 'Número de documento de identificación',
    type: 'DOCUMENTO_ID', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    // Los tipos de documento son metadato del campo, NO opciones de respuesta: la respuesta es
    // el número. Ponerlos en `opciones` haría que la validación exigiera que el número fuera
    // uno de ellos.
    validacion: { patron: '^[A-Za-z0-9.\\-]{4,20}$' },
    ayuda: 'CC, CE, TI, RC, pasaporte u otro.',
  },
  {
    code: 'ID03', order: ord(), label: 'Fecha de nacimiento',
    type: 'FECHA', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    ayuda: 'De aquí se calcula su edad. No tiene que elegir un grupo de edad.',
    alimenta: ['STOP_BANG', 'CAPRINI', 'ARISCAT', 'FRAIL', 'POVOC'],
  },
  {
    code: 'ID04',
    order: ord(),
    label: 'Sexo registrado al nacer (dato usado para escalas clínicas y embarazo)',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    opciones: ['Mujer', 'Hombre', 'Intersexual', 'No sabe', 'Prefiero no responder'],
    alimenta: ['STOP_BANG', 'APFEL'],
  },
  {
    code: 'ID05', order: ord(), label: 'Número de teléfono de contacto',
    type: 'TELEFONO', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
  },
  {
    code: 'ID06', order: ord(), label: 'Entidad aseguradora',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    opciones: ['Particular', 'Otra'],
  },
  {
    code: 'ID07', order: ord(), label: '¿Quién está respondiendo?',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    opciones: ['Paciente', 'Madre', 'Padre', 'Tutor o cuidador', 'Otro'],
    ayuda: 'Si el paciente es menor de edad, debe responder un acudiente.',
  },
  {
    code: 'ID08', order: ord(), label: 'Nombre y relación del acudiente',
    type: 'TEXTO_CORTO', obligacion: 'C', fuente: 'P', seccion: 'identificacion',
    activacion: alguna(ES_PEDIATRICO, noEnLista('ID07', ['paciente'])),
  },
  {
    code: 'ID09', order: ord(), label: 'Grupo sanguíneo, si lo conoce',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    opciones: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'No sabe'],
    ayuda: 'Si no lo sabe, seleccione "No sabe". No lo adivine.',
  },
  {
    code: 'ID10', order: ord(), label: '¿Cuál es su peso actual?',
    type: 'NUMERO', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    validacion: { min: 0.5, max: 400, unidad: 'kg' },
    alimenta: ['STOP_BANG', 'CAPRINI'],
  },
  {
    code: 'ID11', order: ord(), label: '¿Cuál es su estatura?',
    type: 'NUMERO', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    validacion: { min: 30, max: 250, unidad: 'cm' },
    alimenta: ['STOP_BANG', 'CAPRINI'],
  },
  {
    // No está en la Especificación: lo añade la plataforma para poder enviarle el documento
    // al paciente. Se mantiene fuera del rango ID01-ID11 de la spec a propósito.
    code: 'ID12', order: ord(), label: 'Correo electrónico',
    type: 'CORREO', obligacion: 'O', fuente: 'P', seccion: 'identificacion',
    ayuda: 'Para enviarle su valoración cuando esté lista.',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// Rama ginecoobstétrica (Especificación §3). El sexo NO crea por sí solo una ruta extensa:
// abre estas preguntas cuando es biológica y clínicamente pertinente.
// ═════════════════════════════════════════════════════════════════════════════════════════

const GESTACION_POSIBLE: Rule = todo(
  enLista('ID04', ['mujer', 'intersexual']),
  hecho('edad_anios', 'gte', 10),
  hecho('edad_anios', 'lte', 60),
);

const GINECO_OBSTETRICO: DictQuestion[] = [
  {
    code: 'GO01', order: ord(), label: '¿Existe posibilidad de embarazo actualmente?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'gineco_obstetrico',
    opciones: ['Sí', 'No', 'No sabe', 'No aplica'],
    activacion: GESTACION_POSIBLE,
  },
  {
    code: 'GO02', order: ord(), label: 'Fecha de la última menstruación',
    type: 'FECHA', obligacion: 'C', fuente: 'P', seccion: 'gineco_obstetrico',
    opciones: ['No recuerda', 'No menstrúa'],
    activacion: todo(GESTACION_POSIBLE, noEnLista('GO01', ['no aplica'])),
  },
  {
    code: 'GO03', order: ord(), label: '¿Tiene embarazo confirmado?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'gineco_obstetrico',
    opciones: ['Sí', 'No', 'Pendiente de prueba'],
    activacion: enLista('GO01', ['si', 'no sabe']),
  },
  {
    code: 'GO04', order: ord(), label: 'Semanas de embarazo, si las conoce',
    type: 'NUMERO', obligacion: 'C', fuente: 'P', seccion: 'gineco_obstetrico',
    validacion: { min: 1, max: 45, unidad: 'semanas' },
    activacion: si('GO03'),
  },
  {
    code: 'GO05', order: ord(), label: '¿Está en las primeras 6 semanas después de un parto?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'gineco_obstetrico',
    opciones: [...SI_NO_NS], activacion: GESTACION_POSIBLE, alimenta: ['CAPRINI'],
  },
  {
    code: 'GO06', order: ord(), label: '¿Usa anticonceptivos con estrógeno o terapia hormonal?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'gineco_obstetrico',
    opciones: [...SI_NO_NS], activacion: GESTACION_POSIBLE, alimenta: ['CAPRINI'],
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 4. Procedimiento y contexto quirúrgico (Especificación §4) — TODO dato de sistema.
// "El paciente no debe decidir si una cirugía es de alto riesgo, cuánto durará o qué tipo de
// incisión tendrá. Estas variables son responsabilidad de la programación y del anestesiólogo."
// Ninguna de estas preguntas se le muestra jamás al paciente (obligacion 'S').
// ═════════════════════════════════════════════════════════════════════════════════════════

const PROCEDIMIENTO: DictQuestion[] = [
  {
    code: 'PX01', order: ord(), label: 'Cirugía o procedimiento programado',
    type: 'TEXTO_CORTO', obligacion: 'S', fuente: 'S', seccion: 'procedimiento',
  },
  {
    code: 'PX02', order: ord(), label: 'Diagnóstico preoperatorio',
    type: 'TEXTO_CORTO', obligacion: 'S', fuente: 'S', seccion: 'procedimiento',
    ayuda: 'No se le exige al paciente conocerlo.',
  },
  {
    code: 'PX03', order: ord(), label: 'Fecha del procedimiento',
    type: 'FECHA', obligacion: 'S', fuente: 'S', seccion: 'procedimiento',
  },
  {
    code: 'PX04', order: ord(), label: 'Especialidad',
    type: 'SELECCION_UNICA', obligacion: 'S', fuente: 'S', seccion: 'procedimiento',
    opciones: ['ORL', 'Plástica', 'General', 'Bariátrica', 'Ginecología', 'Ortopedia', 'Columna',
      'Cardiovascular', 'Urología', 'Maxilofacial', 'Endoscopia', 'Otra'],
  },
  {
    code: 'PX05', order: ord(), label: 'Modalidad',
    type: 'SELECCION_UNICA', obligacion: 'S', fuente: 'S', seccion: 'procedimiento',
    opciones: ['Ambulatoria', 'Hospitalización', 'No definida'], alimenta: ['CAPRINI'],
  },
  {
    code: 'PX06', order: ord(), label: 'Prioridad',
    type: 'SELECCION_UNICA', obligacion: 'S', fuente: 'S', seccion: 'procedimiento',
    opciones: ['Electiva', 'Urgente', 'Emergencia'], alimenta: ['ARISCAT'],
  },
  {
    code: 'PX07', order: ord(), label: 'Sitio quirúrgico ARISCAT',
    type: 'SELECCION_UNICA', obligacion: 'S', fuente: 'S', seccion: 'procedimiento',
    opciones: ['Periférico', 'Abdominal superior', 'Intratorácico'], alimenta: ['ARISCAT'],
  },
  {
    code: 'PX08', order: ord(), label: 'Duración estimada',
    type: 'SELECCION_UNICA', obligacion: 'S', fuente: 'S', seccion: 'procedimiento',
    opciones: ['<2 h', '2-3 h', '>3 h', 'No definida'], alimenta: ['ARISCAT', 'POVOC'],
  },
  {
    code: 'PX09', order: ord(), label: 'Cirugía cardiovascular de alto riesgo RCRI',
    type: 'SELECCION_UNICA', obligacion: 'S', fuente: 'S', seccion: 'procedimiento',
    opciones: ['Sí', 'No', 'Pendiente de clasificación'], alimenta: ['RCRI'],
  },
  {
    code: 'PX10', order: ord(), label: 'Anestesia probable',
    type: 'SELECCION_UNICA', obligacion: 'V', fuente: 'S', seccion: 'procedimiento',
    opciones: ['General', 'Regional', 'Sedación', 'Local', 'Combinada', 'Por definir'],
    alimenta: ['APFEL'],
  },
  {
    code: 'PX11', order: ord(), label: '¿Se esperan opioides posoperatorios?',
    type: 'SELECCION_UNICA', obligacion: 'V', fuente: 'S', seccion: 'procedimiento',
    opciones: ['Sí', 'No', 'Por definir'], alimenta: ['APFEL'],
    ayuda: 'Lo define el plan anestésico. No se le pide al paciente estimarlo.',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 5. Antecedentes patológicos (Especificación §5, páginas 6-7)
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Pregunta de entrada. Si responde Sí, se abren los acordeones. */
const AP00: DictQuestion = {
  code: 'AP00', order: ord(),
  label: '¿Un médico le ha diagnosticado alguna enfermedad o condición de salud?',
  type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'antecedentes',
  opciones: [...SI_NO_NS],
};

/** Un acordeón por grupo — 11 preguntas, no 74. Ver la nota en `groups.ts`. */
const ACORDEONES: DictQuestion[] = GRUPOS_PATOLOGIAS.map((g, i) => ({
  code: `AG${String(i + 1).padStart(2, '0')}`,
  order: ord(),
  label: g.label,
  type: 'ACORDEON_MULTIPLE' as const,
  obligacion: 'C' as const,
  fuente: 'P' as const,
  seccion: 'antecedentes' as const,
  grupo: g.key,
  opciones: opcionesDeGrupo(g),
  activacion: si('AP00'),
  ayuda: 'Marque solo lo que reconozca. "Ninguna de las anteriores" desmarca el resto.',
}));

const ACLARATORIAS: DictQuestion[] = [
  {
    code: 'AP01', order: ord(), label: 'Para cada enfermedad seleccionada: ¿está controlada?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'antecedentes',
    opciones: ['Controlada', 'No controlada', 'No sabe'],
    repiteSobre: 'AG01',
    activacion: si('AP00'),
    ayuda: 'Se pregunta una vez por cada condición que marcó.',
  },
  {
    code: 'AP02', order: ord(),
    label: '¿Ha sido hospitalizado por esta enfermedad en los últimos 6 meses?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'antecedentes',
    opciones: [...SI_NO_NS], activacion: si('AP00'),
  },
  {
    code: 'AP03', order: ord(), label: '¿Presenta actualmente alguno de estos síntomas?',
    type: 'SELECCION_MULTIPLE', obligacion: 'O', fuente: 'P', seccion: 'antecedentes',
    opciones: ['Dolor u opresión en el pecho', 'Falta de aire en reposo', 'Desmayo',
      'Palpitaciones sostenidas', 'Hinchazón de piernas', 'Silbidos respiratorios', 'Fiebre',
      'Ninguno'],
    activacion: ES_ADULTO,
    alimenta: ['DASI', 'RCRI'],
  },
  {
    code: 'AP04', order: ord(),
    label: 'Durante el último mes, ¿ha tenido infección respiratoria?',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'antecedentes',
    opciones: ['No', 'Resfriado o gripa', 'Bronquitis', 'Neumonía', 'COVID-19', 'No sabe'],
    alimenta: ['ARISCAT'],
  },
  {
    code: 'AP05', order: ord(),
    label: '¿Tiene actualmente tos, fiebre, flema, congestión o silbidos?',
    type: 'SELECCION_MULTIPLE', obligacion: 'O', fuente: 'P', seccion: 'antecedentes',
    opciones: ['Tos', 'Fiebre', 'Flema', 'Congestión', 'Silbidos', 'Ninguno'],
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 6. Medicamentos y tratamientos (Especificación §6)
// "El formulario identifica riesgos y entrega la información al anestesiólogo. No debe ordenar
// al paciente suspender o modificar medicamentos automáticamente."
// ═════════════════════════════════════════════════════════════════════════════════════════

const TOMA_MEDICAMENTOS = si('RX01');

const MEDICAMENTOS: DictQuestion[] = [
  {
    code: 'RX01', order: ord(),
    label: '¿Toma actualmente medicamentos, inyecciones, inhaladores, gotas, vitaminas o productos naturales?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'medicamentos',
    opciones: [...SI_NO_NS],
  },
  {
    code: 'RX02', order: ord(), label: 'Agregue cada medicamento',
    type: 'REPETIDOR', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    activacion: TOMA_MEDICAMENTOS,
    campos: [
      { key: 'nombre', label: 'Nombre', type: 'TEXTO_CORTO', requerido: true },
      { key: 'dosis', label: 'Dosis', type: 'TEXTO_CORTO' },
      { key: 'frecuencia', label: 'Frecuencia', type: 'TEXTO_CORTO' },
      { key: 'via', label: 'Vía', type: 'SELECCION_UNICA',
        opciones: ['Oral', 'Inyectada', 'Inhalada', 'Tópica', 'Gotas', 'Otra'] },
      { key: 'ultima_dosis', label: 'Última dosis, si la conoce', type: 'TEXTO_CORTO' },
    ],
  },
  {
    code: 'RX03', order: ord(), label: '¿Utiliza anticoagulantes?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'anticoagulantes', activacion: TOMA_MEDICAMENTOS,
    opciones: ['Warfarina', 'Apixabán', 'Rivaroxabán', 'Dabigatrán', 'Edoxabán',
      'Heparina o enoxaparina', 'Otro', 'No sabe', 'Ninguno'],
  },
  {
    code: 'RX04', order: ord(), label: '¿Utiliza antiagregantes?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'antiagregantes', activacion: TOMA_MEDICAMENTOS,
    opciones: ['Aspirina', 'Clopidogrel', 'Ticagrelor', 'Prasugrel', 'Otro', 'No sabe', 'Ninguno'],
  },
  {
    code: 'RX05', order: ord(), label: '¿Utiliza insulina?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'insulina', opciones: [...SI_NO_NS], alimenta: ['RCRI'],
    activacion: alguna(TOMA_MEDICAMENTOS, incluye('AG03', ['Diabetes tipo 1', 'Diabetes tipo 2', 'Uso de insulina'])),
  },
  {
    code: 'RX06', order: ord(), label: 'Tipo, dosis y horario de la insulina',
    type: 'TEXTO_LARGO', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'insulina', activacion: si('RX05'),
  },
  {
    code: 'RX07', order: ord(), label: '¿Utiliza medicamentos SGLT2?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'sglt2', activacion: TOMA_MEDICAMENTOS,
    opciones: ['Empagliflozina', 'Dapagliflozina', 'Canagliflozina', 'Ertugliflozina', 'Otro',
      'No sabe', 'Ninguno'],
  },
  {
    code: 'RX08', order: ord(), label: '¿Usa corticoides por tiempo prolongado?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'corticoides', activacion: TOMA_MEDICAMENTOS,
    opciones: ['Prednisona o prednisolona', 'Dexametasona', 'Hidrocortisona', 'Otro', 'No sabe',
      'Ninguno'],
  },
  {
    code: 'RX09', order: ord(), label: '¿Usa medicamentos naturales o suplementos?',
    type: 'TEXTO_LARGO', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    activacion: TOMA_MEDICAMENTOS,
  },
];

/** Módulo GLP-1 / GIP y vaciamiento gástrico (Especificación §6, documento de módulos §10). */
const USA_GLP1 = todo(
  respondida('GL01'),
  noEnLista('GL01', ['ninguno', 'no sabe']),
);

const GLP1: DictQuestion[] = [
  {
    code: 'GL01', order: ord(),
    label: '¿Utiliza medicamentos para diabetes o pérdida de peso de este grupo?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'glp1',
    opciones: ['Semaglutida (Ozempic, Wegovy, Rybelsus)', 'Tirzepatida (Mounjaro, Zepbound)',
      'Liraglutida (Saxenda, Victoza)', 'Dulaglutida (Trulicity)', 'Exenatida (Byetta, Bydureon)',
      'Otro', 'Ninguno', 'No sabe'],
    activacion: alguna(
      TOMA_MEDICAMENTOS,
      incluye('AG03', ['Diabetes tipo 1', 'Diabetes tipo 2', 'Obesidad tratada médicamente']),
    ),
  },
  {
    code: 'GL02', order: ord(), label: '¿Con qué frecuencia lo utiliza?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'glp1', opciones: ['Diario', 'Semanal', 'Otra', 'No sabe'], activacion: USA_GLP1,
  },
  {
    code: 'GL03', order: ord(), label: '¿Cuándo fue la última dosis?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'glp1', activacion: USA_GLP1,
    opciones: ['Hoy', 'Ayer', 'Hace 2-7 días', 'Más de 7 días', 'No sabe'],
  },
  {
    code: 'GL04', order: ord(), label: '¿Está aumentando actualmente la dosis?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'glp1', opciones: [...SI_NO_NS], activacion: USA_GLP1,
  },
  {
    code: 'GL05', order: ord(), label: '¿Presenta síntomas digestivos actuales?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'medicamentos',
    modulo: 'glp1', activacion: USA_GLP1,
    opciones: ['Náuseas', 'Vómito', 'Llenura prolongada', 'Distensión', 'Dolor abdominal',
      'Reflujo', 'Estreñimiento intenso', 'Ninguno'],
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 7. Alergias, anestesia previa, transfusión y dentición (Especificación §7)
// ═════════════════════════════════════════════════════════════════════════════════════════

const ALERGIAS_ANESTESIA: DictQuestion[] = [
  {
    code: 'AL01', order: ord(), label: '¿Es alérgico a algún medicamento, alimento o sustancia?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'alergias_anestesia',
    opciones: [...SI_NO_NS],
  },
  {
    code: 'AL02', order: ord(), label: '¿A qué es alérgico?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'alergias_anestesia',
    activacion: si('AL01'),
    opciones: ['Medicamento', 'Alimento', 'Látex', 'Adhesivos', 'Clorhexidina',
      'Medio de contraste', 'Otro'],
    ayuda: 'Especifique el nombre exacto de la sustancia.',
  },
  {
    code: 'AL03', order: ord(), label: '¿Qué reacción presentó?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'alergias_anestesia',
    activacion: si('AL01'),
    opciones: ['Ronchas o urticaria', 'Hinchazón', 'Falta de aire', 'Anafilaxia', 'Erupción',
      'Náuseas o vómito', 'Otra', 'No sabe'],
  },
  {
    code: 'AN01', order: ord(), label: '¿Ha recibido anestesia o sedación previamente?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'alergias_anestesia',
    opciones: [...SI_NO_NS],
  },
  {
    code: 'AN02', order: ord(), label: '¿Qué cirugías o procedimientos le realizaron?',
    type: 'TEXTO_LARGO', obligacion: 'C', fuente: 'P', seccion: 'alergias_anestesia',
    activacion: si('AN01'), ayuda: 'Una lista breve, con el año aproximado.',
  },
  {
    code: 'AN03', order: ord(), label: '¿Tuvo alguna complicación con la anestesia?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'alergias_anestesia',
    activacion: si('AN01'), alimenta: ['APFEL'],
    opciones: ['Ninguna', 'Intubación o vía aérea difícil', 'Náuseas o vómitos intensos',
      'Alergia o anafilaxia', 'Despertar prolongado', 'Fiebre muy alta o hipertermia maligna',
      'Ingreso inesperado a UCI', 'Recordar el procedimiento estando anestesiado', 'Otra',
      'No sabe'],
  },
  {
    code: 'AN04', order: ord(),
    label: '¿Algún familiar tuvo una complicación grave con la anestesia?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'alergias_anestesia',
    opciones: [...SI_NO_NS],
  },
  {
    code: 'AN05', order: ord(), label: 'Describa la complicación del familiar',
    type: 'TEXTO_LARGO', obligacion: 'C', fuente: 'P', seccion: 'alergias_anestesia',
    activacion: si('AN04'),
  },
  {
    code: 'TR01', order: ord(), label: '¿Ha recibido transfusión de sangre?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'alergias_anestesia',
    opciones: [...SI_NO_NS],
  },
  {
    code: 'TR02', order: ord(), label: '¿Tuvo reacción a una transfusión?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'alergias_anestesia',
    opciones: [...SI_NO_NS], activacion: si('TR01'),
  },
  {
    code: 'TR03', order: ord(), label: '¿Acepta transfusiones si fueran necesarias?',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'alergias_anestesia',
    opciones: ['Sí', 'No', 'Deseo discutirlo con el anestesiólogo'],
  },
  {
    code: 'DE01', order: ord(),
    label: '¿Tiene prótesis dental, implantes, diseño de sonrisa o dientes flojos?',
    type: 'SELECCION_MULTIPLE', obligacion: 'O', fuente: 'P', seccion: 'alergias_anestesia',
    opciones: ['Prótesis removible', 'Prótesis fija o coronas', 'Implantes o diseño', 'Dientes flojos',
      'Ortodoncia', 'Ninguno'],
    ayuda: 'Es importante para proteger sus dientes durante la anestesia.',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 8. Hábitos y exposiciones (Especificación §8)
// ═════════════════════════════════════════════════════════════════════════════════════════

const HABITOS: DictQuestion[] = [
  {
    code: 'HB01', order: ord(), label: '¿Fuma cigarrillos o utiliza vapeadores?',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'habitos',
    opciones: ['Nunca', 'Exfumador', 'Cigarrillos actuales', 'Vapeador actual', 'Ambos'],
    alimenta: ['APFEL'],
  },
  {
    code: 'HB02', order: ord(), label: '¿Cuántos cigarrillos fuma al día?',
    type: 'NUMERO', obligacion: 'C', fuente: 'P', seccion: 'habitos',
    validacion: { min: 0, max: 200 },
    activacion: enLista('HB01', ['cigarrillos actuales', 'ambos']),
  },
  {
    code: 'HB03', order: ord(), label: '¿Cuántas veces usa el vapeador al día?',
    type: 'NUMERO', obligacion: 'C', fuente: 'P', seccion: 'habitos',
    validacion: { min: 0, max: 500 },
    activacion: enLista('HB01', ['vapeador actual', 'ambos']),
  },
  {
    code: 'HB04', order: ord(), label: '¿Cuándo dejó de fumar?',
    type: 'TEXTO_CORTO', obligacion: 'C', fuente: 'P', seccion: 'habitos',
    activacion: enLista('HB01', ['exfumador']),
  },
  {
    code: 'HB05', order: ord(), label: '¿Con qué frecuencia consume alcohol?',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'habitos',
    opciones: ['Nunca', 'Una vez al mes o menos', '2-4 veces al mes', '2-3 veces por semana',
      '4 o más veces por semana'],
  },
  {
    code: 'HB06', order: ord(), label: '¿Ha consumido sustancias psicoactivas recientemente?',
    type: 'SELECCION_MULTIPLE', obligacion: 'O', fuente: 'P', seccion: 'habitos',
    opciones: ['No', 'Cannabis', 'Cocaína', 'Anfetaminas o éxtasis', 'Opioides no formulados',
      'Otra', 'Prefiero discutirlo con el anestesiólogo'],
    ayuda: 'Esta información es confidencial y solo la ve su anestesiólogo. Es importante para su seguridad.',
  },
  {
    code: 'HB07', order: ord(), label: '¿Cuándo fue el último consumo?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'habitos',
    opciones: ['Hoy', 'Ayer', '2-7 días', '8-30 días', 'Más de 30 días', 'No sabe'],
    activacion: todo(
      respondida('HB06'),
      { kind: 'answer', code: 'HB06', op: 'notIncludes', value: ['No'] },
    ),
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 9. Capacidad funcional y DASI condicional (Especificación §9)
// ═════════════════════════════════════════════════════════════════════════════════════════

const CF_OPCIONES = ['Sí', 'No', 'No sabe', 'No puedo por una limitación física'] as const;

/**
 * DASI se abre si el tamizaje es dudoso o negativo, hay síntomas, la cirugía es elevada o se
 * necesita cuantificar. "No asignar ≥4 METs automáticamente cuando hay discordancia."
 */
const ABRIR_DASI: Rule = alguna(
  // Se enumera lo que ABRE el DASI en positivo, en vez de negar "respondió Sí": una pregunta
  // todavía sin contestar haría cierta la negación y el DASI se abriría desde el principio.
  enLista('CF01', ['no', 'no sabe', 'no puedo por una limitacion fisica']),
  enLista('CF02', ['no', 'no sabe', 'no puedo por una limitacion fisica']),
  incluye('AP03', [
    'Dolor u opresión en el pecho', 'Falta de aire en reposo', 'Desmayo',
    'Palpitaciones sostenidas', 'Hinchazón de piernas', 'Silbidos respiratorios',
  ]),
  // Valores del ENUM de la agenda, no etiquetas: `scheduleToFacts` pasa `ABDOMINAL_SUPERIOR`,
  // y comparar contra "Abdominal superior" fallaría en silencio (la rama no se abriría nunca).
  hecho('px.sitio_quirurgico', 'in', ['ABDOMINAL_SUPERIOR', 'INTRATORACICO']),
);

const DASI_ACTIVIDADES: readonly [string, string][] = [
  ['D01', 'Cuidarse personalmente: comer, vestirse, bañarse o usar el baño.'],
  ['D02', 'Caminar dentro de la casa.'],
  ['D03', 'Caminar una o dos cuadras en terreno plano.'],
  ['D04', 'Subir un piso o caminar por una pendiente.'],
  ['D05', 'Correr una distancia corta.'],
  ['D06', 'Realizar labores domésticas ligeras.'],
  ['D07', 'Realizar labores domésticas moderadas.'],
  ['D08', 'Realizar labores domésticas pesadas.'],
  ['D09', 'Realizar trabajo en el jardín.'],
  ['D10', 'Mantener actividad sexual.'],
  ['D11', 'Realizar actividades recreativas moderadas.'],
  ['D12', 'Practicar deportes o ejercicio intenso.'],
];

const CAPACIDAD_FUNCIONAL: DictQuestion[] = [
  {
    code: 'CF01', order: ord(),
    label: '¿Puede subir dos pisos por escaleras sin detenerse por falta de aire, dolor en el pecho, mareo o cansancio intenso?',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'capacidad_funcional',
    opciones: [...CF_OPCIONES], activacion: ES_ADULTO, alimenta: ['DASI'],
  },
  {
    code: 'CF02', order: ord(),
    label: '¿Puede caminar cuatro cuadras o realizar labores domésticas moderadas sin esos síntomas?',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'capacidad_funcional',
    opciones: [...CF_OPCIONES], activacion: ES_ADULTO, alimenta: ['DASI'],
  },
  ...DASI_ACTIVIDADES.map(([code, label]) => ({
    code,
    order: ord(),
    label,
    type: 'SELECCION_UNICA' as const,
    obligacion: 'C' as const,
    fuente: 'P' as const,
    seccion: 'capacidad_funcional' as const,
    modulo: 'dasi',
    opciones: ['Sí', 'No por limitación física', 'No la realiza, pero considera que podría', 'No sabe'],
    activacion: todo(ES_ADULTO, ABRIR_DASI),
    alimenta: ['DASI'] as const,
    ayuda: '¿Puede realizar actualmente esta actividad?',
  })),
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 10. Sueño y náuseas posoperatorias (Especificación §10)
// ═════════════════════════════════════════════════════════════════════════════════════════

const SUENO_NAUSEAS: DictQuestion[] = [
  {
    code: 'SB01', order: ord(),
    label: '¿Ronca fuerte, más fuerte que hablar o se escucha desde otra habitación?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'sueno_nauseas',
    modulo: 'stop_bang', opciones: [...SI_NO_NS], activacion: ES_ADULTO, alimenta: ['STOP_BANG'],
  },
  {
    code: 'SB02', order: ord(), label: '¿Se siente cansado, fatigado o somnoliento durante el día?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'sueno_nauseas',
    modulo: 'stop_bang', opciones: [...SI_NO_NS], activacion: ES_ADULTO, alimenta: ['STOP_BANG'],
  },
  {
    code: 'SB03', order: ord(), label: '¿Alguien ha observado que deja de respirar mientras duerme?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'sueno_nauseas',
    modulo: 'stop_bang', opciones: [...SI_NO_NS], activacion: ES_ADULTO, alimenta: ['STOP_BANG'],
  },
  {
    code: 'SB04', order: ord(), label: '¿Tiene diagnóstico de apnea del sueño?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'sueno_nauseas',
    modulo: 'stop_bang', opciones: [...SI_NO_NS], activacion: ES_ADULTO,
    ayuda: 'No suma puntos adicionales; sirve para planear el manejo.',
  },
  {
    code: 'SB05', order: ord(), label: '¿Utiliza CPAP u otro dispositivo para dormir?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'sueno_nauseas',
    modulo: 'stop_bang', activacion: alguna(si('SB04'), incluye('AG02', ['Uso de CPAP'])),
    opciones: ['Sí y lo uso regularmente', 'Sí pero no lo uso', 'No', 'No aplica'],
  },
  {
    code: 'SB06', order: ord(), label: '¿Traerá su dispositivo el día del procedimiento?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'sueno_nauseas',
    modulo: 'stop_bang', activacion: enLista('SB05', ['si y lo uso regularmente', 'si pero no lo uso']),
    opciones: ['Sí', 'No', 'No sabe', 'No aplica'],
  },
  {
    code: 'SB07', order: ord(), label: 'Circunferencia del cuello',
    type: 'NUMERO', obligacion: 'V', fuente: 'P', seccion: 'sueno_nauseas',
    modulo: 'stop_bang', validacion: { min: 20, max: 80, unidad: 'cm' },
    activacion: ES_ADULTO, alimenta: ['STOP_BANG'],
    ayuda: 'Si no la conoce, déjela en blanco: se mide en la consulta presencial.',
  },
  {
    code: 'NV01', order: ord(),
    label: '¿Ha presentado náuseas o vómitos intensos después de una anestesia?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'sueno_nauseas',
    modulo: 'apfel', opciones: [...SI_NO_NS], activacion: ES_ADULTO, alimenta: ['APFEL'],
  },
  {
    code: 'NV02', order: ord(), label: '¿Se marea o vomita fácilmente durante viajes?',
    type: 'SI_NO_NOSABE', obligacion: 'O', fuente: 'P', seccion: 'sueno_nauseas',
    modulo: 'apfel', opciones: [...SI_NO_NS], activacion: ES_ADULTO, alimenta: ['APFEL'],
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 11. Fragilidad y soporte funcional (Especificación §11)
// Automática en ≥65 años; en menores si hay dependencia, ayuda para caminar, pérdida de peso o
// enfermedad avanzada. La CFS NO se autoadministra: requiere valoración clínica presencial.
// ═════════════════════════════════════════════════════════════════════════════════════════

const ACTIVAR_FRAIL: Rule = alguna(
  hecho('banda_etaria', 'in', ['ADULTO_65', 'ADULTO_75']),
  incluye('AG06', ['Demencia o deterioro cognitivo']),
  incluye('AG08', ['Cáncer activo']),
);

const FRAGILIDAD: DictQuestion[] = [
  {
    code: 'FR01', order: ord(), label: '¿Se siente cansado la mayor parte del tiempo?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'fragilidad',
    modulo: 'frail', opciones: [...SI_NO_NS], activacion: ACTIVAR_FRAIL, alimenta: ['FRAIL'],
  },
  {
    code: 'FR02', order: ord(), label: '¿Tiene dificultad para subir un piso por escaleras?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'fragilidad',
    modulo: 'frail', opciones: [...SI_NO_NS], activacion: ACTIVAR_FRAIL, alimenta: ['FRAIL'],
  },
  {
    code: 'FR03', order: ord(), label: '¿Tiene dificultad para caminar una cuadra?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'fragilidad',
    modulo: 'frail', opciones: [...SI_NO_NS], activacion: ACTIVAR_FRAIL, alimenta: ['FRAIL'],
  },
  {
    code: 'FR04', order: ord(), label: '¿Tiene cinco o más enfermedades diagnosticadas?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'S', seccion: 'fragilidad',
    modulo: 'frail', opciones: [...SI_NO_NS], activacion: ACTIVAR_FRAIL, alimenta: ['FRAIL'],
    ayuda: 'Se calcula desde sus antecedentes; confirme si tiene dudas.',
  },
  {
    code: 'FR05', order: ord(),
    label: '¿Ha perdido más del 5% de su peso durante el último año sin proponérselo?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'fragilidad',
    modulo: 'frail', opciones: [...SI_NO_NS], activacion: ACTIVAR_FRAIL, alimenta: ['FRAIL'],
  },
  {
    code: 'FR06', order: ord(), label: '¿Usa ayuda para caminar?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'fragilidad',
    modulo: 'frail', activacion: ACTIVAR_FRAIL,
    opciones: ['No', 'Bastón', 'Caminador', 'Silla de ruedas', 'Ayuda de otra persona'],
  },
  {
    code: 'FR07', order: ord(),
    label: '¿Necesita ayuda para bañarse, vestirse, alimentarse o usar el baño?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'fragilidad',
    modulo: 'frail', activacion: ACTIVAR_FRAIL,
    opciones: ['Bañarse', 'Vestirse', 'Alimentarse', 'Usar el baño', 'Ninguna'],
  },
  {
    code: 'FR08', order: ord(), label: '¿Ha tenido caídas durante el último año?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'fragilidad',
    modulo: 'frail', activacion: ACTIVAR_FRAIL,
    opciones: ['No', 'Una', 'Dos o más', 'No sabe'],
  },
  {
    code: 'FR09', order: ord(), label: '¿Dispone de cuidador o apoyo después del procedimiento?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'fragilidad',
    modulo: 'frail', activacion: ACTIVAR_FRAIL,
    opciones: ['Sí', 'No', 'No definido'],
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 12. Riesgo tromboembólico: datos para Caprini (Especificación §12)
// Se activa en cirugía mayor, hospitalización, ortopedia, columna, oncológica, inmovilidad o
// antecedente trombótico. Edad, IMC y características quirúrgicas se obtienen automáticamente.
// ═════════════════════════════════════════════════════════════════════════════════════════

const ACTIVAR_CAPRINI: Rule = alguna(
  hecho('px.modalidad', 'equals', 'HOSPITALIZACION'),
  hecho('px.especialidad', 'in', ['ORTOPEDIA', 'COLUMNA', 'CARDIOVASCULAR', 'GENERAL', 'BARIATRICA']),
  hecho('px.duracion_estimada', 'in', ['ENTRE_2_Y_3H', 'MAYOR_3H']),
  incluye('AG05', ['Trombosis venosa o embolia pulmonar', 'Trombofilia']),
  incluye('AG08', ['Cáncer activo', 'Quimioterapia']),
);

const TROMBOEMBOLICO: DictQuestion[] = [
  {
    code: 'TE01', order: ord(), label: '¿Ha tenido trombosis venosa profunda o embolia pulmonar?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', opciones: [...SI_NO_NS], activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
  },
  {
    code: 'TE02', order: ord(), label: '¿Padres, hermanos o hijos han tenido trombosis o embolia?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', opciones: [...SI_NO_NS], activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
  },
  {
    code: 'TE03', order: ord(), label: '¿Le han diagnosticado una trombofilia?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
    opciones: ['Factor V Leiden', 'Mutación de protrombina 20210A', 'Homocisteína elevada',
      'Anticoagulante lúpico', 'Anticardiolipinas', 'Déficit de proteína C, S o antitrombina',
      'Trombocitopenia por heparina', 'Otra', 'No sabe', 'Ninguna'],
  },
  {
    code: 'TE04', order: ord(), label: '¿Tiene actualmente una pierna hinchada?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', opciones: [...SI_NO_NS], activacion: ACTIVAR_CAPRINI,
  },
  {
    code: 'TE05', order: ord(), label: '¿Tiene várices visibles?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', opciones: [...SI_NO_NS], activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
  },
  {
    code: 'TE06', order: ord(), label: '¿Ha permanecido en cama durante 3 días o más recientemente?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', opciones: [...SI_NO_NS], activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
  },
  {
    code: 'TE07', order: ord(), label: '¿Tiene yeso, férula o inmovilizador?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', opciones: [...SI_NO_NS], activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
  },
  {
    code: 'TE08', order: ord(), label: '¿Ha tenido sepsis, neumonía o infarto durante el último mes?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
    opciones: ['Ninguno', 'Sepsis', 'Neumonía', 'Infarto', 'No sabe'],
  },
  {
    code: 'TE09', order: ord(), label: '¿Tiene enfermedad inflamatoria intestinal?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', opciones: [...SI_NO_NS], activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
  },
  {
    code: 'TE10', order: ord(), label: '¿Tiene cáncer activo o recibe quimioterapia?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
    opciones: ['No', 'Cáncer activo', 'Quimioterapia', 'Ambos', 'No sabe'],
  },
  {
    code: 'TE11', order: ord(), label: '¿Tiene un catéter venoso central?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', opciones: [...SI_NO_NS], activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
  },
  {
    code: 'TE12', order: ord(),
    label: '¿Ha tenido accidente cerebrovascular, fractura de cadera, pelvis o pierna, trauma mayor o lesión medular reciente?',
    type: 'SELECCION_MULTIPLE', obligacion: 'C', fuente: 'P', seccion: 'tromboembolico',
    modulo: 'caprini', activacion: ACTIVAR_CAPRINI, alimenta: ['CAPRINI'],
    opciones: ['Ninguno', 'Accidente cerebrovascular', 'Fractura de cadera, pelvis o pierna',
      'Trauma mayor', 'Lesión medular', 'No sabe'],
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 14. Ruta pediátrica (Especificación §14)
// Las respuestas provienen del acudiente, salvo preguntas apropiadas para adolescentes.
// "No aplicar Apfel adulto a niños; el tabaquismo y otros factores adultos no son equivalentes."
// ═════════════════════════════════════════════════════════════════════════════════════════

const PEDIATRICO: DictQuestion[] = [
  {
    code: 'PD01', order: ord(), label: '¿De cuántas semanas de embarazo nació el niño?',
    type: 'NUMERO', obligacion: 'C', fuente: 'P', seccion: 'pediatrico',
    validacion: { min: 20, max: 45, unidad: 'semanas' },
    activacion: hecho('banda_etaria', 'in', ['NEONATO', 'LACTANTE', 'NINO']),
  },
  {
    code: 'PD02', order: ord(), label: '¿Nació prematuro?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'pediatrico',
    opciones: [...SI_NO_NS],
    activacion: hecho('banda_etaria', 'in', ['NEONATO', 'LACTANTE', 'NINO']),
  },
  {
    code: 'PD03', order: ord(), label: '¿Ha presentado apnea o pausas respiratorias?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'pediatrico',
    opciones: [...SI_NO_NS], activacion: ES_PEDIATRICO,
  },
  {
    code: 'PD04', order: ord(),
    label: '¿Tiene cardiopatía congénita, síndrome genético o enfermedad neuromuscular?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'pediatrico',
    opciones: [...SI_NO_NS], activacion: ES_PEDIATRICO,
  },
  {
    code: 'PD05', order: ord(),
    label: '¿Ha tenido recientemente resfriado, tos, fiebre, flema, congestión o silbidos?',
    type: 'SELECCION_MULTIPLE', obligacion: 'O', fuente: 'P', seccion: 'pediatrico',
    activacion: ES_PEDIATRICO, alimenta: ['ARISCAT'],
    opciones: ['Resfriado', 'Tos', 'Fiebre', 'Flema', 'Congestión', 'Silbidos', 'Ninguno',
      'No sabe'],
  },
  {
    code: 'PD06', order: ord(), label: '¿Ronca o deja de respirar mientras duerme?',
    type: 'SELECCION_UNICA', obligacion: 'O', fuente: 'P', seccion: 'pediatrico',
    activacion: ES_PEDIATRICO,
    opciones: ['Ronca', 'Pausas', 'Ambos', 'Ninguno', 'No sabe'],
  },
  {
    code: 'PD07', order: ord(), label: '¿Ha sido hospitalizado por problemas respiratorios?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'pediatrico',
    opciones: [...SI_NO_NS], activacion: ES_PEDIATRICO,
  },
  {
    code: 'PD08', order: ord(), label: 'Fecha y motivo de la hospitalización respiratoria',
    type: 'TEXTO_LARGO', obligacion: 'C', fuente: 'P', seccion: 'pediatrico',
    activacion: si('PD07'),
  },
  {
    code: 'PD09', order: ord(),
    label: '¿Tiene dificultades importantes de comunicación, conducta o cooperación?',
    type: 'SI_NO_NOSABE', obligacion: 'C', fuente: 'P', seccion: 'pediatrico',
    opciones: [...SI_NO_NS], activacion: ES_PEDIATRICO,
    ayuda: 'Describa qué apoyos le ayudan; sirve para planear la inducción.',
  },
  {
    code: 'PD10', order: ord(),
    label: '¿El niño o un familiar ha presentado vómito después de una anestesia?',
    type: 'SELECCION_UNICA', obligacion: 'C', fuente: 'P', seccion: 'pediatrico',
    modulo: 'povoc', activacion: ES_PEDIATRICO, alimenta: ['POVOC'],
    opciones: ['Niño', 'Familiar', 'Ambos', 'Ninguno', 'No sabe'],
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 15. Documentos (Especificación §15). El paciente adjunta; NO transcribe valores técnicos.
// ═════════════════════════════════════════════════════════════════════════════════════════

const DOCUMENTOS: DictQuestion[] = [
  {
    code: 'DC01', order: ord(), label: 'Adjunte sus exámenes de laboratorio e informes',
    type: 'ARCHIVO', obligacion: 'C', fuente: 'P', seccion: 'documentos',
    ayuda: 'Puede subir fotos o PDF. No hace falta que escriba los resultados: los leemos del documento.',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════

export const QUESTION_DICTIONARY: readonly DictQuestion[] = [
  ...IDENTIFICACION,
  ...GINECO_OBSTETRICO,
  ...PROCEDIMIENTO,
  AP00,
  ...ACORDEONES,
  ...ACLARATORIAS,
  ...MEDICAMENTOS,
  ...GLP1,
  ...ALERGIAS_ANESTESIA,
  ...HABITOS,
  ...CAPACIDAD_FUNCIONAL,
  ...SUENO_NAUSEAS,
  ...FRAGILIDAD,
  ...TROMBOEMBOLICO,
  ...PEDIATRICO,
  ...DOCUMENTOS,
];

/** Códigos que NUNCA se le muestran al paciente: los aporta la agenda o el anestesiólogo. */
export const CODIGOS_SISTEMA: readonly string[] = QUESTION_DICTIONARY.filter(
  (q) => q.obligacion === 'S',
).map((q) => q.code);
