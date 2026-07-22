import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host { display:block; max-width:640px; }
    .page-head { margin-bottom:20px; }
    .page-title { font-family:var(--font-display); font-size:22px; font-weight:600; letter-spacing:-0.5px; color:var(--text); }
    .page-sub { font-size:13px; color:var(--muted); margin-top:6px; line-height:1.5; }
    .field { margin-bottom:14px; }
    .save-row { display:flex; align-items:center; gap:12px; margin-top:20px; }
    .saved { color:var(--green); font-size:12px; font-weight:600; }
    .assets { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:8px; }
    .preview { border:1px dashed var(--border2); border-radius:10px; padding:12px; min-height:76px;
      display:flex; align-items:center; justify-content:center; background:var(--bg3); margin-bottom:10px; }
    .preview img { max-height:60px; max-width:100%; }
    .preview .placeholder { font-size:12px; color:var(--muted2); }
    input[type=file] { font-size:12px; color:var(--muted); }
    input[type=file]::file-selector-button { font-family:var(--font-body); font-size:12px; font-weight:500;
      padding:6px 12px; margin-right:10px; border-radius:7px; border:1px solid var(--border2);
      background:#fff; color:var(--text); cursor:pointer; transition:all 160ms; }
    input[type=file]::file-selector-button:hover { border-color:var(--primary); background:var(--it-50); }
    .toggle-row { display:flex; align-items:center; gap:10px; font-size:14px; color:var(--text); cursor:pointer; }
    .toggle-row input { width:18px; height:18px; cursor:pointer; }
  `],
  template: `
    <div class="page-head">
      <div class="page-title">Mi perfil</div>
      <p class="page-sub">Tú subes tu logo de clínica y tu firma; se insertan en el PDF. Los archivos no se guardan en el proyecto, sino en tu perfil.</p>
    </div>

    <div class="card">
      <div class="section-label">Datos del profesional</div>

      <div class="field">
        <label class="ki-label" for="pf-name">Nombre completo</label>
        <input id="pf-name" class="ki-input" [(ngModel)]="p.fullName" data-testid="profile-name-input" />
      </div>
      <div class="field">
        <label class="ki-label" for="pf-spec">Especialidad</label>
        <input id="pf-spec" class="ki-input" [(ngModel)]="p.specialty" />
      </div>
      <div class="field">
        <label class="ki-label" for="pf-reg">Registro médico</label>
        <input id="pf-reg" class="ki-input" [(ngModel)]="p.medicalRegistry" data-testid="profile-registry-input" />
      </div>
      <div class="field">
        <label class="ki-label" for="pf-foot">Texto de pie de página</label>
        <input id="pf-foot" class="ki-input" [(ngModel)]="p.footerText" />
      </div>

      <div class="save-row">
        <button class="btn btn-primary" (click)="save()" data-testid="profile-save-button">Guardar datos</button>
        @if (savedMsg()) { <span class="saved" role="status" aria-live="polite">{{ savedMsg() }}</span> }
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="section-label">Recordatorio matutino</div>
      <p class="page-sub" style="margin:2px 0 12px;">
        Cada mañana (7:00, hora de Colombia) recibes un correo con tus cirugías de hoy y mañana,
        resaltando las que son en menos de 48 horas y aún no están aprobadas. Está activado por defecto.
      </p>
      <label class="toggle-row">
        <input type="checkbox" [checked]="reminderOn()" (change)="toggleReminder($event)" data-testid="profile-reminder-toggle" />
        <span>Enviarme el recordatorio matutino de cirugías</span>
      </label>
      @if (reminderMsg()) { <span class="saved" style="display:block;margin-top:8px;">{{ reminderMsg() }}</span> }
    </div>

    <div class="card" style="margin-top:16px">
      <div class="section-label">Branding</div>
      <div class="assets">
        <div class="asset">
          <label class="ki-label">Logo de la clínica</label>
          <div class="preview">
            @if (logoUrl()) { <img [src]="logoUrl()" alt="logo" /> } @else { <span class="placeholder">Sin logo</span> }
          </div>
          <input type="file" accept="image/*" (change)="upload('logo', $event)" data-testid="profile-logo-input" />
        </div>
        <div class="asset">
          <label class="ki-label">Firma</label>
          <div class="preview">
            @if (signatureUrl()) { <img [src]="signatureUrl()" alt="firma" /> } @else { <span class="placeholder">Sin firma</span> }
          </div>
          <input type="file" accept="image/*" (change)="upload('signature', $event)" data-testid="profile-signature-input" />
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="section-label">Sesión</div>
      <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Cierra tu sesión en este dispositivo.</p>
      <button class="btn" (click)="signOut()" data-testid="panel-logout-button">Cerrar sesión</button>
    </div>
  `,
})
export class ProfilePage implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  p: any = { fullName: '', specialty: '', medicalRegistry: '', footerText: '' };
  logoUrl = signal<string | null>(null);
  signatureUrl = signal<string | null>(null);
  savedMsg = signal('');
  reminderOn = signal(true); // ON por defecto
  reminderMsg = signal('');

  async ngOnInit() {
    const { profile } = await this.api.getProfile();
    this.p = { fullName: profile.fullName, specialty: profile.specialty ?? '', medicalRegistry: profile.medicalRegistry ?? '', footerText: profile.footerText ?? '' };
    this.logoUrl.set(profile.clinicLogoUrl ? `${profile.clinicLogoUrl}?t=${Date.now()}` : null);
    this.signatureUrl.set(profile.signatureUrl ? `${profile.signatureUrl}?t=${Date.now()}` : null);
    this.reminderOn.set(!profile.dailyReminderOptOut);
  }

  /** Cierra sesión y vuelve al sign in. */
  async signOut() {
    await this.auth.logout();
    this.router.navigate(['/signin']);
  }

  async toggleReminder(ev: Event) {
    const on = (ev.target as HTMLInputElement).checked;
    this.reminderOn.set(on);
    // optOut es el inverso del switch (switch ON = recibir = optOut false).
    await this.api.updateProfile({ dailyReminderOptOut: !on });
    this.reminderMsg.set(on ? '✔ Recordatorio activado' : '✔ Recordatorio desactivado');
    setTimeout(() => this.reminderMsg.set(''), 2000);
  }

  async save() {
    await this.api.updateProfile(this.p);
    this.savedMsg.set('✔ Guardado');
    setTimeout(() => this.savedMsg.set(''), 2000);
  }

  async upload(kind: 'logo' | 'signature', ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const res = await this.api.uploadBranding(kind, file);
    if (res.ok && res.url) {
      const url = `${res.url}?t=${Date.now()}`;
      if (kind === 'logo') this.logoUrl.set(url); else this.signatureUrl.set(url);
    }
  }
}
