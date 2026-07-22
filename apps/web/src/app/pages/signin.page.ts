import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; position: relative; z-index: 1; }
    .signin-card { width: 100%; max-width: 380px; padding: 32px 30px; }
    .brand { font-family: var(--font-display); font-size: 22px; font-weight: 600; letter-spacing: -0.5px; color: var(--primary); margin: 0 0 4px; }
    .brand-sub { font-size: 13px; color: var(--muted); margin: 0 0 24px; }
    .field { margin-bottom: 16px; }
    .error { color: var(--red); font-size: 12px; margin-bottom: 16px; }
    .signin-submit { width: 100%; justify-content: center; }
  `],
  template: `
    <div class="wrap">
      <form class="card signin-card" (ngSubmit)="submit()">
        <h1 class="brand">AnestIA</h1>
        <p class="brand-sub">Valoración preanestésica</p>
        <div class="field">
          <label class="ki-label" for="email">Correo</label>
          <input class="ki-input" id="email" name="email" type="email" [(ngModel)]="email" data-testid="signin-email-input" autocomplete="username" />
        </div>
        <div class="field">
          <label class="ki-label" for="password">Contraseña</label>
          <input class="ki-input" id="password" name="password" type="password" [(ngModel)]="password" data-testid="signin-password-input" autocomplete="current-password" />
        </div>
        @if (error()) {
          <div class="error" role="alert" data-testid="signin-error">{{ error() }}</div>
        }
        <button type="submit" class="btn btn-primary signin-submit" [disabled]="loading()" data-testid="signin-submit-button">
          {{ loading() ? 'Entrando…' : 'Iniciar sesión' }}
        </button>
      </form>
    </div>
  `,
})
export class SignInPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  async submit() {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('Credenciales inválidas.');
    } finally {
      this.loading.set(false);
    }
  }
}
