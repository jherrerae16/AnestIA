/**
 * Códigos con los que el backend habla del cuestionario.
 *
 * El resto del sistema no debe escribir literales de código sueltos: se importan de aquí. Así,
 * si la especificación renumera un ítem, hay UN sitio que cambiar y el compilador encuentra a
 * todos sus consumidores.
 *
 * ── Correspondencia con la numeración anterior (P1–P28) ──────────────────────────────────
 * Se documenta porque los documentos ya generados citan `formulario:P14` y hay que poder leer
 * qué significaba. La numeración vieja NO se acepta: `formAnswersSchema` la rechaza.
 *
 *   P1 → ID01   P2 → ID02   P3 → ID03   P4 → ID04   P5 → ID10   P6 → ID11
 *   P7 → ID05   P8 → ID06   P9 → PX01   P10 → PX03  P11 → ID09  P12 → AP00
 *   P13 → AG01-AG11 (11 acordeones)     P14 → RX01  P15 → RX02  P16 → AL01
 *   P17 → AL02  P18 → AN01  P19 → AN02  P20 → TR01  P21 → DE01  P22 → HB01
 *   P23 → HB02/HB03 (cigarrillo y vapeo se separaron)           P24/P25 → HB05
 *   P26/P27 → HB06/HB07                 P28 → ID12
 *
 * Nótese que P9 y P10 (procedimiento y fecha) pasaron a ser datos de AGENDA: la especificación
 * es explícita en que el paciente no aporta las características del acto quirúrgico.
 */
export const CODES = {
  // Identificación
  nombre: 'ID01',
  documento: 'ID02',
  fechaNacimiento: 'ID03',
  sexoNacimiento: 'ID04',
  telefono: 'ID05',
  aseguradora: 'ID06',
  quienResponde: 'ID07',
  acudiente: 'ID08',
  grupoSanguineo: 'ID09',
  peso: 'ID10',
  talla: 'ID11',
  correo: 'ID12',

  // Agenda quirúrgica (datos de sistema)
  procedimiento: 'PX01',
  diagnosticoPreop: 'PX02',
  fechaProcedimiento: 'PX03',

  // Antecedentes
  tieneEnfermedad: 'AP00',
  controlPorEnfermedad: 'AP01',
  hospitalizadoPorEnfermedad: 'AP02',
  sintomasActuales: 'AP03',
  infeccionRespiratoria: 'AP04',
  sintomasRespiratorios: 'AP05',

  // Medicamentos
  tomaMedicamentos: 'RX01',
  listaMedicamentos: 'RX02',
  anticoagulantes: 'RX03',
  antiagregantes: 'RX04',
  insulina: 'RX05',
  sglt2: 'RX07',
  corticoides: 'RX08',
  naturales: 'RX09',
  glp1: 'GL01',
  glp1UltimaDosis: 'GL03',
  glp1Sintomas: 'GL05',

  // Alergias, anestesia, transfusión, dentición
  esAlergico: 'AL01',
  aQueEsAlergico: 'AL02',
  reaccionAlergica: 'AL03',
  anestesiaPrevia: 'AN01',
  cualesCirugias: 'AN02',
  complicacionAnestesica: 'AN03',
  transfusionPrevia: 'TR01',
  protesisDental: 'DE01',

  // Hábitos
  tabaco: 'HB01',
  cigarrillosDia: 'HB02',
  vapeoDia: 'HB03',
  alcohol: 'HB05',
  psicoactivas: 'HB06',

  // Capacidad funcional
  escaleras: 'CF01',
  caminar: 'CF02',

  // Sueño y náuseas (STOP-Bang y Apfel)
  roncaFuerte: 'SB01',
  cansancioDiurno: 'SB02',
  pausasRespiratorias: 'SB03',
  apneaDiagnosticada: 'SB04',
  cuello: 'SB07',
  nvpoPrevio: 'NV01',
  cinetosis: 'NV02',

  // Fragilidad (FRAIL)
  fatiga: 'FR01',
  resistencia: 'FR02',
  ambulacion: 'FR03',
  cincoEnfermedades: 'FR04',
  perdidaPeso: 'FR05',

  // Tromboembólico (Caprini)
  tvpPrevia: 'TE01',
  tvpFamiliar: 'TE02',
  trombofilia: 'TE03',
  piernaHinchada: 'TE04',
  varices: 'TE05',
  reposoCama: 'TE06',
  inmovilizador: 'TE07',
  sepsisNeumoniaInfarto: 'TE08',
  eii: 'TE09',
  cancerQuimio: 'TE10',
  cateterCentral: 'TE11',
  eventoMayor: 'TE12',

  // Pediátrico (POVOC)
  vomitoPrevio: 'PD10',
} as const;

export type CodeKey = keyof typeof CODES;

/** Los 11 acordeones de antecedentes (`P13` de la numeración anterior). */
export const CODIGOS_ACORDEON = [
  'AG01', 'AG02', 'AG03', 'AG04', 'AG05', 'AG06', 'AG07', 'AG08', 'AG09', 'AG10', 'AG11',
] as const;

/** Los 12 ítems del DASI. */
export const CODIGOS_DASI = [
  'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'D11', 'D12',
] as const;
