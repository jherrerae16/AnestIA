/**
 * Agonistas del receptor GLP-1 (genéricos + nombres comerciales). Declararlos activa
 * la lógica de riesgo de vaciamiento gástrico / broncoaspiración (CS8).
 */
export const GLP1_DRUGS = [
  'semaglutida', 'liraglutida', 'tirzepatida', 'dulaglutida', 'exenatida', 'lixisenatida',
  'ozempic', 'wegovy', 'rybelsus', 'saxenda', 'victoza', 'mounjaro', 'trulicity', 'byetta', 'bydureon',
] as const;

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Detecta si un texto (respuesta P14) menciona un agonista GLP-1. */
export function detectGLP1(text: string | null | undefined): { declared: boolean; drug?: string } {
  if (!text) return { declared: false };
  const t = norm(text);
  for (const drug of GLP1_DRUGS) {
    if (t.includes(norm(drug))) return { declared: true, drug };
  }
  return { declared: false };
}
