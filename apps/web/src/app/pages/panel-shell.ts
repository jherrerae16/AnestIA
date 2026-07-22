import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-panel-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styles: [`
    :host { display: block; }
    .layout { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }

    /* ── Sidebar teal profundo (rediseño institucional A) ── */
    .side {
      position: sticky; top: 0; align-self: start; height: 100vh;
      background: var(--side); color: var(--side-ink);
      display: flex; flex-direction: column; gap: 4px;
      padding: 20px 14px; z-index: 100;
    }
    .brand { display: flex; align-items: center; gap: 11px; min-width: 0; padding: 4px 6px 18px; text-decoration: none; }
    .brand-icon {
      width: 40px; height: 40px; border-radius: 9px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--primary-hi); color: #fff; font-weight: 700; font-size: 16px;
      overflow: hidden; font-family: var(--font-display);
    }
    .brand-icon.has-logo { background: #fff; padding: 3px; }
    .brand-icon img { width: 100%; height: 100%; object-fit: contain; }
    .brand-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
    .brand-name { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--side-ink); letter-spacing: -0.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .brand-sub { font-size: 11px; color: var(--side-mut); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .nav-section { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--side-mut); padding: 12px 10px 6px; font-weight: 600; }
    .nav-items { display: flex; flex-direction: column; gap: 2px; }
    .nav-items a {
      display: flex; align-items: center; gap: 11px;
      padding: 9px 11px; font-size: 13.5px; font-weight: 500;
      color: var(--side-mut); border-radius: var(--radius-sm); text-decoration: none;
      transition: background .15s, color .15s; min-height: 40px;
    }
    .nav-items a .ico { width: 18px; text-align: center; flex-shrink: 0; opacity: .9; font-size: 14px; }
    .nav-items a:hover { background: var(--side-on); color: var(--side-on-ink); }
    .nav-items a.on { background: var(--primary-hi); color: #fff; }
    .nav-items a.on .ico { opacity: 1; }

    .side-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px; }
    .who { font-size: 11.5px; color: var(--side-mut); padding: 0 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .side-foot .btn-out {
      display: flex; align-items: center; gap: 9px; width: 100%;
      padding: 9px 11px; font-size: 13px; font-weight: 500; cursor: pointer;
      background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: var(--radius-sm);
      color: var(--side-ink); transition: background .15s, border-color .15s; min-height: 40px;
    }
    .side-foot .btn-out:hover { background: var(--side-on); border-color: rgba(255,255,255,0.28); }

    /* El sidebar ya acota la izquierda; el contenido usa el ancho restante con un tope amplio
       para no dejar franjas muertas en monitores anchos. Padding lateral generoso. */
    main { padding: 30px 48px 56px; max-width: 1720px; margin: 0 auto; width: 100%; position: relative; z-index: 1; }

    /* ── Móvil: el sidebar se vuelve topbar horizontal scrollable ── */
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .side {
        position: sticky; top: 0; height: auto; flex-direction: row; align-items: center;
        gap: 10px; padding: 10px 14px; overflow-x: auto;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .brand { padding: 0 8px 0 0; border-right: 1px solid rgba(255,255,255,0.1); }
      .brand-sub { display: none; }
      .nav-section { display: none; }
      .nav-items { flex-direction: row; gap: 2px; }
      .nav-items a { white-space: nowrap; min-height: 38px; }
      .nav-items a .ico { display: none; }
      .side-foot { margin-top: 0; margin-left: auto; padding-top: 0; border-top: none; flex-direction: row; align-items: center; }
      .side-foot .who { display: none; }
      main { padding: 22px 18px 40px; }
    }
  `],
  template: `
    <div class="layout">
      <aside class="side">
        <a class="brand" routerLink="/dashboard">
          <span class="brand-icon" [class.has-logo]="!!auth.profile()?.clinicLogoUrl">
            @if (auth.profile()?.clinicLogoUrl) {
              <img [src]="auth.profile()!.clinicLogoUrl" alt="" />
            } @else { A }
          </span>
          <span class="brand-text">
            <span class="brand-name">{{ auth.profile()?.fullName ?? 'AnestIA' }}</span>
            <span class="brand-sub">{{ auth.profile()?.footerText ?? 'Valoración preanestésica' }}</span>
          </span>
        </a>

        <div class="nav-section">Menú</div>
        <nav class="nav-items">
          <a routerLink="/dashboard" routerLinkActive="on"><span class="ico">▤</span>Casos</a>
          <a routerLink="/cases/new" routerLinkActive="on" data-testid="nav-new-case"><span class="ico">＋</span>Nuevo caso</a>
          <a routerLink="/patients" routerLinkActive="on"><span class="ico">◉</span>Pacientes</a>
          <a routerLink="/calendar" routerLinkActive="on" data-testid="nav-calendar"><span class="ico">▦</span>Calendario</a>
          <a routerLink="/presets" routerLinkActive="on"><span class="ico">▧</span>Cuestionarios</a>
          <a routerLink="/directory" routerLinkActive="on"><span class="ico">☰</span>Directorio</a>
          <a routerLink="/profile" routerLinkActive="on" data-testid="nav-profile"><span class="ico">◐</span>Perfil</a>
        </nav>

        <div class="side-foot">
          <span class="who">{{ auth.profile()?.specialty ?? '' }}</span>
          <button class="btn-out" (click)="logout()" data-testid="panel-logout-button"><span class="ico">⏻</span>Salir</button>
        </div>
      </aside>
      <main><router-outlet /></main>
    </div>
  `,
})
export class PanelShell {
  auth = inject(AuthService);
  private router = inject(Router);
  async logout() {
    await this.auth.logout();
    this.router.navigate(['/signin']);
  }
}
