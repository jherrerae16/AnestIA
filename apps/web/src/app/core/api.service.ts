import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ScheduleDef } from '@anestia/shared';

export interface PresetSummary {
  id: string;
  name: string;
  version: number;
  isDefault: boolean;
  questions: unknown[];
}
export interface CreatedCase {
  caseId: string;
  linkToken: string;
  linkExpiresAt: string;
}
export interface SubmitResult {
  ok: boolean;
  errors?: string[];
}

/** Cliente API tipado ligero para el panel y el formulario del paciente. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  listPresets(): Promise<{ presets: PresetSummary[] }> {
    return firstValueFrom(this.http.get<{ presets: PresetSummary[] }>('/api/panel/presets'));
  }
  createCase(presetId: string, schedule: ScheduleDef, patientId?: string): Promise<CreatedCase> {
    return firstValueFrom(
      this.http.post<CreatedCase>('/api/panel/cases', { presetId, schedule, patientId }),
    );
  }
  resolverEscala(caseId: string, escala: string, nota: string): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean }>(`/api/panel/cases/${caseId}/scales/${escala}/resolve`, { nota }),
    );
  }
  updateSchedule(caseId: string, schedule: ScheduleDef): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.put<{ ok: boolean }>(`/api/panel/cases/${caseId}/schedule`, schedule),
    );
  }
  getForm(token: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`/api/form/${token}`));
  }
  acceptConsent(token: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`/api/form/${token}/consent`, {}));
  }
  savePartial(token: string, answers: unknown): Promise<unknown> {
    return firstValueFrom(this.http.post(`/api/form/${token}/save`, { answers }));
  }
  submit(token: string, answers: unknown): Promise<SubmitResult> {
    return firstValueFrom(this.http.post<SubmitResult>(`/api/form/${token}/submit`, { answers }));
  }
  upload(token: string, file: File, type: string): Promise<{ id: string }> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    return firstValueFrom(this.http.post<{ id: string }>(`/api/form/${token}/upload`, fd));
  }

  // --- U5 revisión / aprobación ---
  getReview(caseId: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`/api/panel/cases/${caseId}/review`));
  }
  /** URL del PDF de previsualización (borrador vigente) para embeber en un visor. */
  previewUrl(caseId: string): string {
    return `/api/panel/cases/${caseId}/preview`;
  }
  editField(caseId: string, section: string, key: string, value: string): Promise<unknown> {
    return firstValueFrom(this.http.patch(`/api/panel/cases/${caseId}/assessment`, { section, key, value }));
  }
  /** Veredicto manual del médico sobre un analito (HITL). verdict=null deshace. */
  setLabVerdict(caseId: string, labId: string, verdict: 'NORMAL' | 'ALERTA' | 'CRITICO' | null): Promise<{ manualFlag: string | null; effectiveFlag: string }> {
    return firstValueFrom(this.http.put<{ manualFlag: string | null; effectiveFlag: string }>(`/api/panel/cases/${caseId}/labs/${labId}/verdict`, { verdict }));
  }
  /**
   * Confirma (o vuelve a retener) una lectura que el extractor marcó dudosa. Distinto del
   * veredicto clínico: aquí el médico dice que el valor leído es el que está impreso.
   */
  confirmarLectura(caseId: string, tipo: 'lab' | 'estudio', lecturaId: string, confirmado: boolean): Promise<{ estadoExtraccion: string }> {
    return firstValueFrom(
      this.http.put<{ estadoExtraccion: string }>(
        `/api/panel/cases/${caseId}/lecturas/${tipo}/${lecturaId}/confirmar`,
        { confirmado },
      ),
    );
  }
  /** Re-corre el auditor determinístico sobre el borrador actual. Cero tokens. */
  reaudit(caseId: string): Promise<{ audit: { findings: { level: string; category: string; message: string }[] } | null }> {
    return firstValueFrom(this.http.post<{ audit: { findings: { level: string; category: string; message: string }[] } | null }>(`/api/panel/cases/${caseId}/reaudit`, {}));
  }
  loadExamNormal(caseId: string): Promise<unknown> {
    // attested=true: atestación explícita del médico (CS3). El botón sólo se habilita tras confirmar.
    return firstValueFrom(this.http.post(`/api/panel/cases/${caseId}/exam`, { mode: 'normal', attested: true }));
  }
  approve(caseId: string): Promise<{ ok: boolean; blockers?: string[] }> {
    return firstValueFrom(this.http.post<{ ok: boolean; blockers?: string[] }>(`/api/panel/cases/${caseId}/approve`, {}));
  }
  reject(caseId: string, reason: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`/api/panel/cases/${caseId}/reject`, { reason }));
  }
  /** Reabre un caso aprobado para corregirlo (trazable). */
  reopen(caseId: string, reason: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.http.post<{ ok: boolean }>(`/api/panel/cases/${caseId}/reopen`, { reason }));
  }

  // --- U6 distribución / historial / dashboard ---
  dashboard(status?: string): Promise<any> {
    const q = status ? `?status=${status}` : '';
    return firstValueFrom(this.http.get<any>(`/api/panel/dashboard${q}`));
  }
  listContacts(): Promise<any> {
    return firstValueFrom(this.http.get<any>('/api/panel/directory'));
  }
  addContact(c: { label: string; email: string; type: string; notes?: string }): Promise<any> {
    return firstValueFrom(this.http.post<any>('/api/panel/directory', c));
  }
  distribute(caseId: string, payload: { contactIds: string[]; channel: 'email' | 'link'; sendToPatient?: boolean; subject?: string; body?: string }): Promise<any> {
    return firstValueFrom(this.http.post<any>(`/api/panel/cases/${caseId}/distribute`, payload));
  }
  emailDraft(caseId: string): Promise<{ subject: string; body: string; pdfFilename: string }> {
    return firstValueFrom(this.http.get<{ subject: string; body: string; pdfFilename: string }>(`/api/panel/cases/${caseId}/email-draft`));
  }
  searchPatients(q: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`/api/panel/patients?q=${encodeURIComponent(q)}`));
  }
  getPatient(id: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`/api/panel/patients/${id}`));
  }
  // --- Notas privadas del médico por paciente ---
  getPatientNote(patientId: string): Promise<{ note: PatientNoteDTO | null }> {
    return firstValueFrom(this.http.get<{ note: PatientNoteDTO | null }>(`/api/panel/patients/${patientId}/note`));
  }
  savePatientNote(patientId: string, content: string): Promise<{ note: PatientNoteDTO | null }> {
    return firstValueFrom(this.http.put<{ note: PatientNoteDTO | null }>(`/api/panel/patients/${patientId}/note`, { content }));
  }

  // --- Perfil / branding ---
  getProfile(): Promise<any> {
    return firstValueFrom(this.http.get<any>('/api/panel/profile'));
  }
  updateProfile(data: { fullName?: string; specialty?: string; medicalRegistry?: string; footerText?: string; emailBodyTemplate?: string; dailyReminderOptOut?: boolean }): Promise<any> {
    return firstValueFrom(this.http.patch<any>('/api/panel/profile', data));
  }
  uploadBranding(kind: 'logo' | 'signature', file: File): Promise<{ ok: boolean; url?: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return firstValueFrom(this.http.post<{ ok: boolean; url?: string }>(`/api/panel/profile/branding?kind=${kind}`, fd));
  }

  // --- Calendario de cirugías ---
  calendar(view: 'month' | 'week', anchor: string): Promise<{ view: string; cases: CalendarCase[] }> {
    const q = `?view=${view}&anchor=${anchor}`;
    return firstValueFrom(this.http.get<{ view: string; cases: CalendarCase[] }>(`/api/panel/calendar${q}`));
  }
  /** URL de descarga del .ics de una cirugía (un tap; el dispositivo abre su app de calendario). */
  calendarIcsUrl(caseId: string): string {
    return `/api/panel/cases/${caseId}/calendar.ics`;
  }
  /** URL de descarga del .ics con TODAS las cirugías (exportar el calendario completo). */
  allCalendarIcsUrl(): string {
    return `/api/panel/calendar.ics`;
  }
}

export interface PatientNoteDTO {
  content: string;
  updatedAt: string;
}

export interface CalendarCase {
  caseId: string;
  patientName: string | null;
  procedure: string | null;
  status: string;
  date: string; // YYYY-MM-DD (día de Bogotá)
  procedureDate: string;
  alerta48h: boolean;
}
