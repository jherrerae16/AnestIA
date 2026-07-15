export type ContactTypeT = 'MEDICO' | 'CLINICA' | 'ASEGURADORA' | 'PACIENTE' | 'OTRO';

export interface DeliveryEmailInput {
  patientName: string;
  procedure?: string | null;
  doctorName: string;
  downloadUrl: string;
}

/** Construye el correo de entrega del reporte final. Puro/determinístico. */
export function buildDeliveryEmail(i: DeliveryEmailInput): { subject: string; html: string } {
  const subject = `Valoración preanestésica — ${i.patientName}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#14212b">
    <p>Estimado(a) destinatario(a),</p>
    <p>Adjunto la valoración preanestésica${i.procedure ? ' para <strong>' + escapeText(i.procedure) + '</strong>' : ''} del paciente <strong>${escapeText(i.patientName)}</strong>, aprobada y firmada por ${escapeText(i.doctorName)}.</p>
    <p><a href="${escapeAttr(i.downloadUrl)}" style="background:#0b5c6b;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Descargar documento</a></p>
    <p style="font-size:12px;color:#5b6b73">Enlace: ${escapeText(i.downloadUrl)}</p>
  </div>`;
  return { subject, html };
}

function escapeText(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

export interface PatientBase {
  fullName: string;
  documentId: string;
  birthDate?: string | null;
  sex?: string | null;
  insurer?: string | null;
  bloodType?: string | null;
}

/**
 * Precarga de respuestas base al crear un caso para un paciente existente (US-6.3/RF-11.5).
 * Devuelve un mapa questionOrder→value con los datos conocidos, para reconfirmación.
 */
export function prefillFromPatient(p: PatientBase): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.fullName) out['1'] = p.fullName;
  if (p.documentId) out['2'] = p.documentId;
  if (p.birthDate) out['3'] = p.birthDate;
  if (p.sex) out['4'] = p.sex;
  if (p.insurer) out['8'] = p.insurer;
  if (p.bloodType) out['11'] = p.bloodType;
  return out;
}
