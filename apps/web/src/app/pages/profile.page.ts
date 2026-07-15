import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .card { background:#fff; padding:1.5rem; border-radius:12px; max-width:620px; box-shadow:0 1px 6px rgba(0,0,0,.05); }
    label { display:block; font-size:.85rem; margin:.6rem 0 .25rem; color:#33474f; }
    input { width:100%; padding:.55rem; border:1px solid #cdd7da; border-radius:8px; }
    button { padding:.55rem 1rem; background:var(--brand); color:#fff; border:0; border-radius:8px; cursor:pointer; margin-top:.8rem; }
    .assets { display:flex; gap:1.5rem; margin-top:1rem; }
    .asset { flex:1; }
    .preview { border:1px dashed #cdd7da; border-radius:8px; padding:.5rem; min-height:70px; display:flex; align-items:center; justify-content:center; background:#f6f8f9; }
    .preview img { max-height:60px; max-width:100%; }
    .hint { font-size:.8rem; color:#5b6b73; }
    .saved { color:#1e7e34; font-size:.85rem; margin-left:.5rem; }
  `],
  template: `
    <div class="card">
      <h2>Mi perfil</h2>
      <p class="hint">Tú subes tu logo de clínica y tu firma; se insertan en el PDF. Los archivos no se guardan en el proyecto, sino en tu perfil.</p>

      <label>Nombre completo</label>
      <input [(ngModel)]="p.fullName" data-testid="profile-name-input" />
      <label>Especialidad</label>
      <input [(ngModel)]="p.specialty" />
      <label>Registro médico</label>
      <input [(ngModel)]="p.medicalRegistry" data-testid="profile-registry-input" />
      <label>Texto de pie de página</label>
      <input [(ngModel)]="p.footerText" />
      <button (click)="save()" data-testid="profile-save-button">Guardar datos</button>
      @if (savedMsg()) { <span class="saved">{{ savedMsg() }}</span> }

      <div class="assets">
        <div class="asset">
          <label>Logo de la clínica</label>
          <div class="preview">
            @if (logoUrl()) { <img [src]="logoUrl()" alt="logo" /> } @else { <span class="hint">Sin logo</span> }
          </div>
          <input type="file" accept="image/*" (change)="upload('logo', $event)" data-testid="profile-logo-input" />
        </div>
        <div class="asset">
          <label>Firma</label>
          <div class="preview">
            @if (signatureUrl()) { <img [src]="signatureUrl()" alt="firma" /> } @else { <span class="hint">Sin firma</span> }
          </div>
          <input type="file" accept="image/*" (change)="upload('signature', $event)" data-testid="profile-signature-input" />
        </div>
      </div>
    </div>
  `,
})
export class ProfilePage implements OnInit {
  private api = inject(ApiService);
  p: any = { fullName: '', specialty: '', medicalRegistry: '', footerText: '' };
  logoUrl = signal<string | null>(null);
  signatureUrl = signal<string | null>(null);
  savedMsg = signal('');

  async ngOnInit() {
    const { profile } = await this.api.getProfile();
    this.p = { fullName: profile.fullName, specialty: profile.specialty ?? '', medicalRegistry: profile.medicalRegistry ?? '', footerText: profile.footerText ?? '' };
    this.logoUrl.set(profile.clinicLogoUrl ? `${profile.clinicLogoUrl}?t=${Date.now()}` : null);
    this.signatureUrl.set(profile.signatureUrl ? `${profile.signatureUrl}?t=${Date.now()}` : null);
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
