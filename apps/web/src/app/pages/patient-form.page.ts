import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';

interface Q {
  order: number;
  label: string;
  type: string;
  required: boolean;
  options?: string[] | null;
  conditional?: { showIf?: { questionOrder: number; equals: string } } | null;
}

/** Normaliza para comparar condicionales ('sí'→'si'). */
function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .wrap { max-width:640px; margin:0 auto; padding:1rem; }
    header { text-align:center; padding:1rem 0; }
    header img { max-height:56px; }
    h1 { color:var(--brand); font-size:1.3rem; margin:.3rem 0; }
    .consent { background:#fff; padding:1.2rem; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,.06); }
    .consent p { white-space:pre-line; font-size:.85rem; line-height:1.5; max-height:260px; overflow:auto; border:1px solid #e3eaec; padding:.8rem; border-radius:8px; }
    .q { background:#fff; padding:1rem; border-radius:10px; margin-bottom:.7rem; box-shadow:0 1px 6px rgba(0,0,0,.04); }
    .q label { display:block; font-weight:600; margin-bottom:.4rem; font-size:.95rem; }
    .req { color:var(--error); }
    input, select, textarea { width:100%; padding:.55rem; border:1px solid #cdd7da; border-radius:8px; font-size:1rem; }
    .actions { display:flex; gap:.6rem; margin:1.2rem 0; }
    button { flex:1; padding:.75rem; border:0; border-radius:8px; font-size:1rem; cursor:pointer; }
    .primary { background:var(--brand); color:#fff; }
    .secondary { background:#e3eaec; }
    .errors { background:#fdecea; color:var(--error); padding:.8rem; border-radius:8px; font-size:.85rem; }
    .ok { background:#e6f4ea; color:#1e7e34; padding:1rem; border-radius:8px; text-align:center; }
    .files { font-size:.85rem; color:#5b6b73; }
  `],
  template: `
    <div class="wrap">
      @if (loading()) { <p>Cargando…</p> }
      @else if (invalid()) { <div class="errors">Este enlace no es válido o expiró.</div> }
      @else if (done()) {
        <div class="ok" data-testid="form-done">✔ ¡Gracias! Tus respuestas fueron enviadas. Tu anestesiólogo las revisará.</div>
      }
      @else {
        <header>
          @if (branding()?.logo) { <img [src]="branding()!.logo" alt="logo" /> }
          <h1>Valoración preanestésica</h1>
          <p>{{ branding()?.doctor }}</p>
        </header>

        @if (!consentAccepted()) {
          <div class="consent">
            <h2>Autorización de datos (Ley 1581)</h2>
            <p>{{ consentText() }}</p>
            <label style="display:flex;gap:.5rem;margin:.8rem 0;align-items:flex-start">
              <input type="checkbox" [(ngModel)]="consentChecked" data-testid="consent-accept-checkbox" style="width:auto" />
              <span>He leído y acepto el tratamiento de mis datos.</span>
            </label>
            <button class="primary" [disabled]="!consentChecked()" (click)="acceptConsent()" data-testid="consent-continue-button">Continuar</button>
          </div>
        } @else {
          @for (q of visibleQuestions(); track q.order) {
            <div class="q">
              <label>{{ q.label }} @if (q.required) { <span class="req">*</span> }</label>
              @switch (q.type) {
                @case ('SI_NO') {
                  <select [ngModel]="valueOf(q.order)" (ngModelChange)="setAnswer(q, $event)" [attr.data-testid]="'q-' + q.order">
                    <option value="">—</option><option value="si">Sí</option><option value="no">No</option>
                  </select>
                }
                @case ('SELECCION_UNICA') {
                  <select [ngModel]="valueOf(q.order)" (ngModelChange)="setAnswer(q, $event)" [attr.data-testid]="'q-' + q.order">
                    <option value="">—</option>
                    @for (o of q.options ?? []; track o) { <option [value]="o">{{ o }}</option> }
                  </select>
                }
                @case ('TEXTO_LARGO') {
                  <textarea rows="3" [ngModel]="valueOf(q.order)" (ngModelChange)="setAnswer(q, $event)" [attr.data-testid]="'q-' + q.order"></textarea>
                }
                @case ('NUMERO') {
                  <input type="number" [ngModel]="valueOf(q.order)" (ngModelChange)="setAnswer(q, $event)" [attr.data-testid]="'q-' + q.order" />
                }
                @case ('FECHA') {
                  <input type="date" [ngModel]="valueOf(q.order)" (ngModelChange)="setAnswer(q, $event)" [attr.data-testid]="'q-' + q.order" />
                }
                @default {
                  <input type="text" [ngModel]="valueOf(q.order)" (ngModelChange)="setAnswer(q, $event)" [attr.data-testid]="'q-' + q.order" />
                }
              }
            </div>
          }

          <div class="q">
            <label>Adjunta tus exámenes (labs, ECG, eco)</label>
            <input type="file" multiple (change)="onFiles($event)" data-testid="form-attachment-input" />
            @if (uploaded().length) { <p class="files">Subidos: {{ uploaded().length }}</p> }
          </div>

          @if (errors().length) {
            <div class="errors" data-testid="form-errors">
              @for (e of errors(); track e) { <div>• {{ e }}</div> }
            </div>
          }

          <div class="actions">
            <button class="secondary" (click)="savePartial()" data-testid="form-save-partial-button">Guardar y seguir después</button>
            <button class="primary" (click)="submit()" [disabled]="submitting()" data-testid="form-submit-button">Enviar</button>
          </div>
        }
      }
    </div>
  `,
})
export class PatientFormPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  token = '';
  loading = signal(true);
  invalid = signal(false);
  done = signal(false);
  submitting = signal(false);
  branding = signal<{ logo?: string; doctor?: string } | null>(null);
  questions = signal<Q[]>([]);
  consentText = signal('');
  consentAccepted = signal(false);
  consentChecked = signal(false);
  answers = signal<Record<number, { value: unknown; type: string }>>({});
  errors = signal<string[]>([]);
  uploaded = signal<string[]>([]);

  visibleQuestions = computed(() =>
    this.questions().filter((q) => {
      const s = q.conditional?.showIf;
      if (!s) return true;
      return norm(this.answers()[s.questionOrder]?.value) === norm(s.equals);
    }),
  );

  async ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    try {
      const form = await this.api.getForm(this.token);
      this.branding.set(form.branding);
      this.questions.set(form.questions);
      this.consentText.set(form.consent.text);
      this.consentAccepted.set(form.consentAccepted);
      this.done.set(form.submitted);
      this.answers.set(form.answers ?? {});
    } catch {
      this.invalid.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  valueOf(order: number) {
    return this.answers()[order]?.value ?? '';
  }
  setAnswer(q: Q, value: unknown) {
    this.answers.update((a) => ({ ...a, [q.order]: { value, type: q.type } }));
  }

  async acceptConsent() {
    await this.api.acceptConsent(this.token);
    this.consentAccepted.set(true);
  }

  private answersForApi() {
    const out: Record<string, { value: unknown; type: string }> = {};
    for (const [k, v] of Object.entries(this.answers())) out[k] = v;
    return out;
  }

  async savePartial() {
    await this.api.savePartial(this.token, this.answersForApi());
    this.errors.set([]);
  }

  async submit() {
    this.submitting.set(true);
    this.errors.set([]);
    try {
      const res = await this.api.submit(this.token, this.answersForApi());
      if (res.ok) this.done.set(true);
      else this.errors.set(res.errors ?? ['No se pudo enviar.']);
    } catch {
      this.errors.set(['No se pudo enviar. Revisa tu conexión.']);
    } finally {
      this.submitting.set(false);
    }
  }

  async onFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files) return;
    for (const file of Array.from(input.files)) {
      try {
        await this.api.upload(this.token, file, 'OTRO');
        this.uploaded.update((u) => [...u, file.name]);
      } catch {
        this.errors.update((e) => [...e, `No se pudo subir ${file.name}.`]);
      }
    }
  }
}
