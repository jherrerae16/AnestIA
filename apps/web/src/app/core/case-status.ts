/** Etiquetas y clases de badge por estado de caso — compartidas entre dashboard y calendario. */

export const STATUS_LABEL: Record<string, string> = {
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

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/** Clase de badge por estado — reutiliza el design system. */
export function badgeClass(status: string): string {
  switch (status) {
    case 'PENDIENTE_REVISION':
      return 'badge-amber';
    case 'APROBADO':
      return 'badge-green';
    case 'ENTREGADO':
      return 'badge-blue';
    case 'BORRADOR':
    case 'ENVIADO_AL_PACIENTE':
    case 'RESPONDIENDO':
      return 'badge-muted';
    default:
      return 'badge-blue';
  }
}
