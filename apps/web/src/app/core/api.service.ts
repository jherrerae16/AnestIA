import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  createCase(presetId: string, procedure?: string): Promise<CreatedCase> {
    return firstValueFrom(this.http.post<CreatedCase>('/api/panel/cases', { presetId, procedure }));
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
  distribute(caseId: string, contactIds: string[], channel: 'email' | 'link', sendToPatient = false): Promise<any> {
    return firstValueFrom(this.http.post<any>(`/api/panel/cases/${caseId}/distribute`, { contactIds, channel, sendToPatient }));
  }
  searchPatients(q: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`/api/panel/patients?q=${encodeURIComponent(q)}`));
  }
  getPatient(id: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`/api/panel/patients/${id}`));
  }

  // --- Perfil / branding ---
  getProfile(): Promise<any> {
    return firstValueFrom(this.http.get<any>('/api/panel/profile'));
  }
  updateProfile(data: { fullName?: string; specialty?: string; medicalRegistry?: string; footerText?: string }): Promise<any> {
    return firstValueFrom(this.http.patch<any>('/api/panel/profile', data));
  }
  uploadBranding(kind: 'logo' | 'signature', file: File): Promise<{ ok: boolean; url?: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return firstValueFrom(this.http.post<{ ok: boolean; url?: string }>(`/api/panel/profile/branding?kind=${kind}`, fd));
  }
  exportSheets(): Promise<{ ok: boolean; url?: string; error?: string; count?: number }> {
    return firstValueFrom(this.http.post<{ ok: boolean; url?: string; error?: string; count?: number }>('/api/panel/export/sheets', {}));
  }
}
