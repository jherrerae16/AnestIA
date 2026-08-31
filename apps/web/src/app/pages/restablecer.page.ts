import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PASSWORD_MIN } from '@anestia/shared';
import { ApiService } from '../core/api.service';

/**
 * Restablecer la contraseña con el token del correo.
 *
 * Pública: quien llega aquí no tiene sesión, justamente porque perdió el acceso. El token viaja
 * en la URL, así que al terminar se navega al inicio de sesión sin dejarlo en el historial de
 * esta pantalla.
 */
@Component({
  selector: 'app-restablecer',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .wrap { min-height:100vh; display:grid; place-items:center; padding:1.5rem; position:relative; z-index:1; }
    .card-reset { width:100%; max-width:400px; padding:32px 30px; }
    .brand { font-family:var(--font-display); font-size:22px; font-weight:600; letter-spacing:-0.5px; color:var(--primary); margin:0 0 4px; }
    .brand-sub { font-size:13px; color:var(--muted); margin:0 0 24px; }
    .field { margin-bottom:16px; }
    .hint { font-size:11.5px; color:var(--muted2); margin-top:5px; }
    .error { color:var(--red); font-size:12.5px; margin-bottom:14px; }
    .ok { font-size:13px; color:var(--muted); line-height:1.6; }
    .full { width:100%; justify-content:center; }
  `],
  template: `
    <div class="wrap">
      <div class="card card-reset">
        <h1 class="brand">AnestIA</h1>
        <p class="brand-sub">Restablecer contraseña</p>

        @if (listo()) {
          <p class="ok" data-testid="reset-ok">
            ✔ Tu contraseña quedó cambiada. Ya puedes iniciar sesión con ella.
          </p>
          <button class="btn btn-primary full" style="margin-top:16px" (click)="irAlInicio()"
                  data-testid="reset-ir-login">Ir a iniciar sesión</button>
        } @else if (!token()) {
          <p class="ok" data-testid="reset-sin-token">
            Este enlace está incompleto. Pide uno nuevo desde la pantalla de inicio de sesión.
          </p>
          <button class="btn full" style="margin-top:16px" (click)="irAlInicio()">Volver</button>
        } @else {
          <div class="field">
            <label class="ki-label" for="nueva">Contraseña nueva</label>
            <input class="ki-input" id="nueva" type="password" autocomplete="new-password"
                   [ngModel]="nueva()" (ngModelChange)="nueva.set($event); error.set('')"
                   data-testid="reset-nueva" />
            <div class="hint">Mínimo {{ min }} caracteres.</div>
          </div>
          @if (error()) { <div class="error" role="alert" data-testid="reset-error">{{ error() }}</div> }
          <button class="btn btn-primary full" (click)="guardar()"
                  [disabled]="guardando() || nueva().length < min" data-testid="reset-guardar">
            {{ guardando() ? 'Guardando…' : 'Cambiar contraseña' }}
          </button>
        }
      </div>
    </div>
  `,
})
export class RestablecerPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly min = PASSWORD_MIN;
  token = signal('');
  nueva = signal('');
  error = signal('');
  guardando = signal(false);
  listo = signal(false);

  ngOnInit() {
    this.token.set(this.route.snapshot.queryParamMap.get('token') ?? '');
  }

  async guardar() {
    this.guardando.set(true);
    this.error.set('');
    try {
      await this.api.restablecerPassword(this.token(), this.nueva());
      this.nueva.set('');
      this.listo.set(true);
    } catch (e: any) {
      this.error.set(
        e?.error?.error ?? e?.error?.issues?.[0]?.message ?? 'No se pudo cambiar la contraseña.',
      );
    } finally {
      this.guardando.set(false);
    }
  }

  irAlInicio() {
    this.router.navigate(['/signin']);
  }
}
