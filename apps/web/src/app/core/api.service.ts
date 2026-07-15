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
}
