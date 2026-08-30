import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ANESTESIAS,
  DURACIONES,
  ESPECIALIDADES,
  ETIQUETAS_AGENDA,
  MODALIDADES,
  PRIORIDADES,
  SITIOS_ARISCAT,
  faltantesDeAgenda,
  type ScheduleDef,
} from '@anestia/shared';

/**
 * Formulario de la programación quirúrgica (`PX01`–`PX11`).
 *
 * Vive aquí y no dentro de una página porque lo usan dos: al crear el caso y al completarlo
 * desde la revisión. Duplicar once campos en dos sitios garantiza que se separen — y lo que se
 * separaría es qué variables alimentan qué escala.
 *
 * Cada campo dice a qué escala alimenta. No es decoración: es lo que le permite al
 * anestesiólogo decidir qué vale la pena llenar cuando tiene prisa.
 */
@Component({
  selector: 'app-schedule-form',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .grupo { margin: 22px 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: var(--muted); }
    .fila { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 560px) { .fila { grid-template-columns: 1fr; } }
    .field { margin-bottom: 16px; }
    .por-que { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .pendientes { margin-top: 18px; padding: 13px 15px; border-radius: 10px;
      background: #fffaeb; border: 1px solid #fedf89; font-size: 12.5px; color: #93370d; }
    .pendientes strong { display: block; margin-bottom: 3px; }
  `],
  template: `
    @if (mostrarTitulo()) { <div class="grupo">Programación quirúrgica</div> }

    <div class="field">
      <label class="ki-label" [attr.for]="id('proc')">Cirugía o procedimiento *</label>
      <input class="ki-input" [id]="id('proc')" [ngModel]="v().procedimiento"
             (ngModelChange)="set('procedimiento', $event)"
             data-testid="sched-procedimiento" placeholder="Colecistectomía laparoscópica" />
    </div>

    <div class="fila">
      <div class="field">
        <label class="ki-label" [attr.for]="id('dx')">Diagnóstico preoperatorio</label>
        <input class="ki-input" [id]="id('dx')" [ngModel]="v().diagnosticoPreop ?? ''"
               (ngModelChange)="set('diagnosticoPreop', $event)"
               data-testid="sched-dx" placeholder="Colelitiasis" />
        <div class="por-que">No se le exige al paciente conocerlo.</div>
      </div>
      <div class="field">
        <label class="ki-label" [attr.for]="id('fecha')">Fecha del procedimiento</label>
        <input class="ki-input" [id]="id('fecha')" type="date" [ngModel]="v().fechaHora ?? ''"
               (ngModelChange)="set('fechaHora', $event)" data-testid="sched-fecha" />
        <div class="por-que">De aquí salen la edad y la ruta clínica del paciente.</div>
      </div>
    </div>

    <div class="fila">
      <div class="field">
        <label class="ki-label" [attr.for]="id('esp')">Especialidad</label>
        <select class="ki-select" [id]="id('esp')" [ngModel]="v().especialidad ?? ''"
                (ngModelChange)="set('especialidad', $event)" data-testid="sched-especialidad">
          <option value="">—</option>
          @for (o of especialidades; track o) { <option [value]="o">{{ etiquetas.especialidad[o] }}</option> }
        </select>
      </div>
      <div class="field">
        <label class="ki-label" [attr.for]="id('mod')">Modalidad</label>
        <select class="ki-select" [id]="id('mod')" [ngModel]="v().modalidad ?? ''"
                (ngModelChange)="set('modalidad', $event)" data-testid="sched-modalidad">
          <option value="">—</option>
          @for (o of modalidades; track o) { <option [value]="o">{{ etiquetas.modalidad[o] }}</option> }
        </select>
        <div class="por-que">Alimenta Caprini.</div>
      </div>
    </div>

    <div class="fila">
      <div class="field">
        <label class="ki-label" [attr.for]="id('pri')">Prioridad</label>
        <select class="ki-select" [id]="id('pri')" [ngModel]="v().prioridad ?? ''"
                (ngModelChange)="set('prioridad', $event)" data-testid="sched-prioridad">
          <option value="">—</option>
          @for (o of prioridades; track o) { <option [value]="o">{{ etiquetas.prioridad[o] }}</option> }
        </select>
        <div class="por-que">Alimenta ARISCAT.</div>
      </div>
      <div class="field">
        <label class="ki-label" [attr.for]="id('sitio')">Sitio quirúrgico</label>
        <select class="ki-select" [id]="id('sitio')" [ngModel]="v().sitioQuirurgico ?? ''"
                (ngModelChange)="set('sitioQuirurgico', $event)" data-testid="sched-sitio">
          <option value="">—</option>
          @for (o of sitios; track o) { <option [value]="o">{{ etiquetas.sitioQuirurgico[o] }}</option> }
        </select>
        <div class="por-que">Alimenta ARISCAT.</div>
      </div>
    </div>

    <div class="fila">
      <div class="field">
        <label class="ki-label" [attr.for]="id('dur')">Duración estimada</label>
        <select class="ki-select" [id]="id('dur')" [ngModel]="v().duracionEstimada ?? ''"
                (ngModelChange)="set('duracionEstimada', $event)" data-testid="sched-duracion">
          <option value="">—</option>
          @for (o of duraciones; track o) { <option [value]="o">{{ etiquetas.duracionEstimada[o] }}</option> }
        </select>
        <div class="por-que">Alimenta ARISCAT y POVOC.</div>
      </div>
      <div class="field">
        <label class="ki-label" [attr.for]="id('anes')">Anestesia probable</label>
        <select class="ki-select" [id]="id('anes')" [ngModel]="v().anestesiaProbable ?? ''"
                (ngModelChange)="set('anestesiaProbable', $event)" data-testid="sched-anestesia">
          <option value="">—</option>
          @for (o of anestesias; track o) { <option [value]="o">{{ etiquetas.anestesiaProbable[o] }}</option> }
        </select>
        <div class="por-que">Alimenta Apfel.</div>
      </div>
    </div>

    <div class="fila">
      <div class="field">
        <label class="ki-label" [attr.for]="id('rcri')">Cirugía cardiovascular de alto riesgo</label>
        <select class="ki-select" [id]="id('rcri')" [ngModel]="triestado(v().altoRiesgoRcri)"
                (ngModelChange)="setBool('altoRiesgoRcri', $event)" data-testid="sched-rcri">
          <option value="">Pendiente de clasificación</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
        <div class="por-que">Alimenta RCRI.</div>
      </div>
      <div class="field">
        <label class="ki-label" [attr.for]="id('opio')">¿Se esperan opioides posoperatorios?</label>
        <select class="ki-select" [id]="id('opio')" [ngModel]="triestado(v().opioidesPostop)"
                (ngModelChange)="setBool('opioidesPostop', $event)" data-testid="sched-opioides">
          <option value="">Por definir</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
        <div class="por-que">Alimenta Apfel. No lo estima el paciente.</div>
      </div>
    </div>

    @if (pendientes().length) {
      <div class="pendientes" data-testid="sched-pendientes">
        <strong>Faltan datos de programación</strong>
        Las escalas que dependan de esto quedarán <em>pendientes</em> en vez de calcularse con
        supuestos. Falta: {{ pendientes().join(', ') }}.
      </div>
    }
  `,
})
export class ScheduleFormComponent {
  /** Agenda editada. Two-way: el padre recibe cada cambio. */
  readonly v = model.required<ScheduleDef>({ alias: 'value' });
  /** Prefijo de los `id` de los campos, para que dos instancias no colisionen. */
  readonly prefijo = input('sched');
  readonly mostrarTitulo = input(true);

  readonly especialidades = ESPECIALIDADES;
  readonly modalidades = MODALIDADES;
  readonly prioridades = PRIORIDADES;
  readonly sitios = SITIOS_ARISCAT;
  readonly duraciones = DURACIONES;
  readonly anestesias = ANESTESIAS;
  readonly etiquetas = ETIQUETAS_AGENDA;

  /** Qué escalas quedarán pendientes por falta de programación. */
  readonly pendientes = computed(() => faltantesDeAgenda(this.v()));

  id(campo: string): string {
    return `${this.prefijo()}-${campo}`;
  }

  set<K extends keyof ScheduleDef>(campo: K, valor: string) {
    this.v.update((s) => ({ ...s, [campo]: valor === '' ? null : valor }) as ScheduleDef);
  }

  /**
   * Los tres estados de un booleano de agenda: '' es "sin definir", que NO es "no". Un null
   * deja la escala pendiente; un false la calcula con el factor ausente.
   */
  setBool(campo: 'altoRiesgoRcri' | 'opioidesPostop', valor: string) {
    this.v.update((s) => ({ ...s, [campo]: valor === '' ? null : valor === 'si' }));
  }

  triestado(v: boolean | null | undefined): string {
    return v == null ? '' : v ? 'si' : 'no';
  }
}
