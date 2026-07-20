/**
 * Etiquetas legibles de los estados del caso. Fuente única del lado backend (la usa la API,
 * p. ej. el correo de recordatorio) para no duplicar el mapa. Los valores del estado son el
 * enum `CaseStatus` de Prisma; aquí sólo viven sus etiquetas de presentación.
 *
 * El frontend Angular mantiene su propia copia en `core/case-status.ts` porque el web no
 * consume este paquete (no está cableado a `@anestia/shared`). Si algún día se cablea, esa
 * copia debe re-exportar desde aquí.
 */
export const CASE_STATUS_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADO_AL_PACIENTE: 'Enviado',
  RESPONDIENDO: 'Respondiendo',
  RESPUESTAS_RECIBIDAS: 'Respuestas recibidas',
  LABS_ANALIZADOS: 'Labs analizados',
  BORRADOR_GENERADO: 'Borrador generado',
  PENDIENTE_REVISION: 'Pendiente revisión',
  APROBADO: 'Aprobado',
  ENTREGADO: 'Entregado',
};

/** Etiqueta legible de un estado; devuelve el propio valor si no está mapeado. */
export function caseStatusLabel(status: string): string {
  return CASE_STATUS_LABEL[status] ?? status;
}
