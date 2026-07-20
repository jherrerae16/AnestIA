import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, CalendarCase } from '../core/api.service';
import { statusLabel, badgeClass } from '../core/case-status';
import { addToCalendar } from '../core/add-to-calendar';

/** Celda de la cuadrícula: un día con sus cirugías. */
interface DayCell {
  iso: string; // YYYY-MM-DD
  dayNum: number;
  inMonth: boolean; // false = día de relleno de mes vecino (sólo vista mensual)
  isToday: boolean;
  cases: CalendarCase[];
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [RouterLink],
  styles: [`
    :host { display:block; }
    .head { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
    .head h2 { font-size:22px; }
    .head p { font-size:13px; color:var(--muted); margin-top:2px; }
    .controls { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .nav-btns { display:flex; align-items:center; gap:8px; }
    .period { font-weight:600; min-width:150px; text-align:center; text-transform:capitalize; }
    .view-toggle { display:flex; background:var(--it-950); border-radius:100px; padding:4px; gap:2px; }
    .view-toggle button {
      padding:6px 14px; font-size:12px; font-weight:500; color:rgba(255,255,255,0.62);
      border:none; background:transparent; border-radius:100px; cursor:pointer; transition:all .2s;
    }
    .view-toggle button.on { background:var(--primary); color:#fff; }

    .grid { display:grid; grid-template-columns:repeat(7,1fr); gap:1px; background:var(--border); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
    .weekday { background:var(--bg3); padding:8px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); text-align:center; }
    .cell { background:#fff; min-height:104px; padding:6px; display:flex; flex-direction:column; gap:4px; }
    .cell.week { min-height:220px; }
    .cell.out { background:var(--bg3); }
    .cell.out .daynum { color:var(--muted2); }
    .daynum { font-size:12px; font-weight:600; color:var(--text); align-self:flex-start; }
    .cell.today .daynum { background:var(--primary); color:#fff; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; }

    .chip { text-decoration:none; border-radius:6px; padding:4px 6px; font-size:11px; line-height:1.25; display:block;
      background:var(--it-50); border-left:3px solid var(--blue); color:var(--text); transition:background .12s; }
    .chip:hover { background:var(--it-100, #eef4ff); }
    .chip .pt { font-weight:600; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .chip .proc { color:var(--muted); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .chip.st-amber { border-left-color:var(--amber, #f59e0b); }
    .chip.st-green { border-left-color:var(--green); }
    .chip.st-blue { border-left-color:var(--blue); }
    .chip.st-muted { border-left-color:var(--muted2); }
    /* Alerta <48h sin aprobar: destaca en rojo, es trabajo pendiente que el médico debe ver. */
    .chip.alerta { background:#fef2f2; border-left-color:var(--red); }
    .chip.alerta .warn { color:var(--red); font-weight:700; }

    .add-cal { margin-top:2px; font-size:10px; color:var(--primary); background:none; border:none; cursor:pointer; padding:0; text-align:left; }
    .add-cal:hover { text-decoration:underline; }

    .empty-note { color:var(--muted); font-size:13px; margin-top:16px; }
    .legend { display:flex; gap:16px; flex-wrap:wrap; font-size:12px; color:var(--muted); margin-top:14px; }
    .legend .dot { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:5px; vertical-align:middle; }

    @media (max-width:720px) {
      .grid { font-size:11px; }
      .cell { min-height:78px; }
      .chip .proc { display:none; }
    }
  `],
  template: `
    <div data-testid="calendar-root">
      <div class="head">
        <div>
          <h2>Calendario de cirugías</h2>
          <p>Tus cirugías programadas. Toca una para abrir el caso.</p>
        </div>
        <div class="controls">
          <div class="view-toggle">
            <button [class.on]="view()==='month'" (click)="setView('month')" data-testid="cal-view-month">Mensual</button>
            <button [class.on]="view()==='week'" (click)="setView('week')" data-testid="cal-view-week">Semanal</button>
          </div>
          <div class="nav-btns">
            <button class="btn btn-sm" (click)="prev()" data-testid="cal-prev">←</button>
            <span class="period">{{ periodLabel() }}</span>
            <button class="btn btn-sm" (click)="next()" data-testid="cal-next">→</button>
            <button class="btn btn-sm" (click)="today()">Hoy</button>
          </div>
        </div>
      </div>

      <div class="grid">
        @for (d of DIAS; track d) { <div class="weekday">{{ d }}</div> }
        @for (cell of cells(); track cell.iso) {
          <div class="cell" [class.week]="view()==='week'" [class.out]="!cell.inMonth" [class.today]="cell.isToday" data-testid="cal-cell">
            <span class="daynum">{{ cell.dayNum }}</span>
            @for (c of cell.cases; track c.caseId) {
              <a class="chip" [class]="'chip ' + chipClass(c)" [routerLink]="['/cases', c.caseId, 'review']"
                 [attr.data-testid]="'cal-chip'">
                <span class="pt">{{ c.patientName ?? '—' }}</span>
                <span class="proc">{{ c.procedure ?? 'Procedimiento' }}</span>
                @if (c.alerta48h) { <span class="warn">⚠ &lt;48h sin aprobar</span> }
              </a>
              <button class="add-cal" (click)="add(c, $event)" [attr.data-testid]="'cal-add'">+ Añadir a mi calendario</button>
            }
          </div>
        }
      </div>

      @if (!hasAnyCase()) {
        <p class="empty-note">No hay cirugías con fecha en este período.</p>
      }

      <div class="legend">
        <span><span class="dot" style="background:var(--red)"></span>Cirugía &lt;48h sin valoración aprobada</span>
        <span><span class="dot" style="background:var(--green)"></span>Aprobado</span>
        <span><span class="dot" style="background:var(--amber,#f59e0b)"></span>Pendiente revisión</span>
      </div>
    </div>
  `,
})
export class CalendarPage implements OnInit {
  private api = inject(ApiService);
  readonly DIAS = DIAS;

  view = signal<'month' | 'week'>('month');
  anchor = signal(startOfToday()); // ancla local (medianoche)
  cases = signal<CalendarCase[]>([]);

  private casesByDay = computed(() => {
    const map = new Map<string, CalendarCase[]>();
    for (const c of this.cases()) {
      const arr = map.get(c.date) ?? [];
      arr.push(c);
      map.set(c.date, arr);
    }
    return map;
  });

  cells = computed<DayCell[]>(() => {
    const byDay = this.casesByDay();
    const todayIso = isoLocal(startOfToday());
    const days = this.view() === 'month' ? monthGrid(this.anchor()) : weekGrid(this.anchor());
    const anchorMonth = this.anchor().getMonth();
    return days.map((d) => ({
      iso: isoLocal(d),
      dayNum: d.getDate(),
      inMonth: this.view() === 'week' ? true : d.getMonth() === anchorMonth,
      isToday: isoLocal(d) === todayIso,
      cases: byDay.get(isoLocal(d)) ?? [],
    }));
  });

  hasAnyCase = computed(() => this.cases().length > 0);

  periodLabel = computed(() => {
    const a = this.anchor();
    if (this.view() === 'week') {
      const wk = weekGrid(a);
      const first = wk[0];
      const last = wk[6];
      return `${first.getDate()} ${MESES[first.getMonth()].slice(0, 3)} – ${last.getDate()} ${MESES[last.getMonth()].slice(0, 3)}`;
    }
    return `${MESES[a.getMonth()]} ${a.getFullYear()}`;
  });

  async ngOnInit() { await this.load(); }

  private async load() {
    const res = await this.api.calendar(this.view(), isoLocal(this.anchor()));
    this.cases.set(res.cases);
  }

  async setView(v: 'month' | 'week') { this.view.set(v); await this.load(); }
  async prev() { this.shift(-1); await this.load(); }
  async next() { this.shift(1); await this.load(); }
  async today() { this.anchor.set(startOfToday()); await this.load(); }

  private shift(dir: 1 | -1) {
    const a = new Date(this.anchor());
    if (this.view() === 'week') a.setDate(a.getDate() + dir * 7);
    else a.setMonth(a.getMonth() + dir);
    this.anchor.set(a);
  }

  chipClass(c: CalendarCase): string {
    if (c.alerta48h) return 'alerta';
    const b = badgeClass(c.status); // badge-amber / badge-green / ...
    return 'st-' + b.replace('badge-', '');
  }

  label(s: string) { return statusLabel(s); }

  add(c: CalendarCase, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    addToCalendar(this.api.calendarIcsUrl(c.caseId));
  }
}

/** Medianoche local de hoy. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO corto YYYY-MM-DD en hora local (para casar con las claves de día del backend). */
function isoLocal(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Grilla mensual: 6 semanas (42 celdas) empezando en lunes, incluye días de meses vecinos. */
function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  // Lunes = 0. getDay(): 0=domingo..6=sábado → mover a base lunes.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Semana (lunes→domingo) que contiene el ancla. */
function weekGrid(anchor: Date): Date[] {
  const offset = (anchor.getDay() + 6) % 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
