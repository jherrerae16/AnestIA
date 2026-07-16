import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Profile {
  id: string;
  fullName: string;
  specialty?: string;
  email?: string;
  clinicLogoUrl?: string;
  footerText?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  readonly profile = signal<Profile | null>(null);

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ ok: boolean; profile: Profile }>('/api/panel/auth/login', { email, password }),
    );
    this.profile.set(res.profile);
  }

  async me(): Promise<Profile | null> {
    try {
      const res: { profile: Profile } = await firstValueFrom(
        this.http.get<{ profile: Profile }>('/api/panel/auth/me'),
      );
      this.profile.set(res.profile);
      return res.profile;
    } catch {
      this.profile.set(null);
      return null;
    }
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/panel/auth/logout', {}));
    this.profile.set(null);
  }
}
