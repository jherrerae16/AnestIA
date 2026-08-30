import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ETIQUETA_TIPO_PROPIA,
  TIPOS_PROPIA,
  siguienteCodigoPropio,
  type PreguntaPropia,
  type TipoPropia,
} from '@anestia/shared';
import { ApiService } from '../core/api.service';

/**
 * Editor de las preguntas propias del anestesiólogo.
 *
 * Lo que NO hace, a propósito: editar el diccionario de la Especificación. De él se generan el
 * prompt clínico, la trazabilidad por código y las variables de las ocho escalas; cambiar un
 * ítem desde una pantalla desincronizaría las cuatro cosas sin que nada fallara a la vista. El
 * servidor lo hace estructuralmente imposible — sólo lee y escribe filas `PROPIA`.
 *
 * Lo que sí hace: dejar que el médico pregunte lo suyo. Son informativas, se le muestran a todos
 * los pacientes y no alimentan ninguna escala.
 */
@Component({
  selector: 'app-preset-editor',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styles: [`
    .wrap { max-width: 760px; }
    .page-heading { font-family:var(--font-display); font-size:22px; font-weight:600;
      letter-spacing:-0.5px; color:var(--text); margin-bottom:4px; }
    .page-sub { font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.6; }
    .volver { display:inline-block; font-size:12.5px; color:var(--muted); margin-bottom:14px; }
    .aviso { background:var(--bg2); border:1px solid var(--border); border-left:3px solid var(--brand);
      border-radius:10px; padding:13px 15px; font-size:12.5px; color:var(--muted); line-height:1.6;
      margin-bottom:20px; }
    .aviso b { color:var(--text); font-weight:600; }
    .q-card { background:var(--bg2); border:1px solid var(--border); border-radius:12px;
      padding:16px 18px; margin-bottom:12px; }
    .q-head { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
    .q-code { font-family:var(--font-mono); font-size:11px; color:var(--muted2); }
    .q-grow { flex:1; }
    .btn-del { font-size:12px; padding:4px 10px; border-radius:6px; border:1px solid var(--border2);
      background:transparent; color:var(--muted); cursor:pointer; }
    .btn-del:hover { color:var(--red-text); border-color:var(--red-text); }
    .campo { margin-bottom:12px; }
    .campo:last-child { margin-bottom:0; }
    .fila { display:grid; grid-template-columns:1fr 190px; gap:12px; }
    @media (max-width:560px) { .fila { grid-template-columns:1fr; } }
    .opciones { display:flex; flex-direction:column; gap:6px; }
    .opcion-row { display:flex; gap:8px; align-items:center; }
    .opcion-row .ki-input { flex:1; }
    .btn-mini { font-size:12px; padding:4px 9px; border-radius:6px; border:1px solid var(--border2);
      background:transparent; color:var(--muted); cursor:pointer; }
    .btn-mini:hover { color:var(--brand); border-color:var(--brand); }
    .acciones { display:flex; align-items:center; gap:12px; margin-top:18px; }
    .errores { background:var(--sev-alerta-bg); border:1px solid var(--sev-alerta-line);
      color:var(--sev-alerta); border-radius:10px; padding:11px 14px; font-size:12.5px;
      margin-bottom:14px; }
    .errores div { margin-bottom:3px; }
    .errores div:last-child { margin-bottom:0; }
    .guardado { font-size:12.5px; color:var(--muted); }
    .empty { font-size:13px; color:var(--muted); padding:18px 0; }
  `],
  template: `
    <div class="wrap" data-testid="preset-editor">
      <a class="volver" routerLink="/presets">← Mis cuestionarios</a>
      <div class="page-heading">Mis preguntas</div>
      <div class="page-sub">
        Preguntas que se añaden al formulario del paciente, además de las de la Especificación.
      </div>

      <div class="aviso">
        <b>Las preguntas de la Especificación del Dr. Luquetta no se editan aquí.</b>
        De ellas dependen la trazabilidad de cada dato del documento y las variables de las ocho
        escalas de riesgo. Las tuyas son informativas: se le muestran a todos los pacientes y
        <b>no alimentan ninguna escala</b>.
      </div>

      @if (errores().length) {
        <div class="errores" data-testid="editor-errores">
          @for (e of errores(); track e) { <div>{{ e }}</div> }
        </div>
      }

      @for (q of propias(); track q.code) {
        <div class="q-card" [attr.data-testid]="'propia-' + q.code">
          <div class="q-head">
            <span class="q-code">{{ q.code }}</span>
            <span class="q-grow"></span>
            <button class="btn-del" (click)="quitar(q.code)"
                    [attr.data-testid]="'quitar-' + q.code">Quitar</button>
          </div>

          <div class="campo fila">
            <div>
              <label class="ki-label" [attr.for]="q.code + '-label'">Pregunta</label>
              <input class="ki-input" [id]="q.code + '-label'" [ngModel]="q.label"
                     (ngModelChange)="editar(q.code, 'label', $event)"
                     [attr.data-testid]="'label-' + q.code"
                     placeholder="¿Quién lo acompaña el día de la cirugía?" />
            </div>
            <div>
              <label class="ki-label" [attr.for]="q.code + '-tipo'">Tipo de respuesta</label>
              <select class="ki-select" [id]="q.code + '-tipo'" [ngModel]="q.type"
                      (ngModelChange)="cambiarTipo(q.code, $event)"
                      [attr.data-testid]="'tipo-' + q.code">
                @for (t of tipos; track t) { <option [value]="t">{{ etiquetas[t] }}</option> }
              </select>
            </div>
          </div>

          <div class="campo">
            <label class="ki-label" [attr.for]="q.code + '-ayuda'">Texto de apoyo (opcional)</label>
            <input class="ki-input" [id]="q.code + '-ayuda'" [ngModel]="q.ayuda ?? ''"
                   (ngModelChange)="editar(q.code, 'ayuda', $event)"
                   [attr.data-testid]="'ayuda-' + q.code"
                   placeholder="En lenguaje sencillo, para el paciente." />
          </div>

          @if (llevaOpciones(q)) {
            <div class="campo">
              <label class="ki-label">Opciones</label>
              <div class="opciones">
                @for (o of q.options ?? []; track $index; let i = $index) {
                  <div class="opcion-row">
                    <input class="ki-input" [ngModel]="o"
                           (ngModelChange)="editarOpcion(q.code, i, $event)"
                           [attr.data-testid]="'opcion-' + q.code + '-' + i" />
                    <button class="btn-mini" (click)="quitarOpcion(q.code, i)">×</button>
                  </div>
                }
              </div>
              <button class="btn-mini" style="margin-top:8px" (click)="agregarOpcion(q.code)"
                      [attr.data-testid]="'agregar-opcion-' + q.code">+ Opción</button>
            </div>
          }
        </div>
      } @empty {
        <div class="empty" data-testid="editor-vacio">
          Todavía no has añadido preguntas propias.
        </div>
      }

      <div class="acciones">
        <button class="btn btn-sm" (click)="agregar()" data-testid="agregar-propia">
          + Añadir pregunta
        </button>
        <button class="btn btn-primary btn-sm" (click)="guardar()"
                [disabled]="guardando() || !propias().length" data-testid="guardar-propias">
          {{ guardando() ? 'Guardando…' : 'Guardar' }}
        </button>
        @if (guardado()) { <span class="guardado" role="status">✔ Guardado</span> }
      </div>
    </div>
  `,
})
export class PresetEditorPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  presetId = '';
  propias = signal<PreguntaPropia[]>([]);
  errores = signal<string[]>([]);
  guardando = signal(false);
  guardado = signal(false);

  readonly tipos = TIPOS_PROPIA;
  readonly etiquetas = ETIQUETA_TIPO_PROPIA;

  /** Los dos tipos que llevan opciones. Los demás no las muestran ni las guardan. */
  llevaOpciones = (q: PreguntaPropia) =>
    q.type === 'SELECCION_UNICA' || q.type === 'SELECCION_MULTIPLE';

  readonly hayCambios = computed(() => this.propias().length > 0);

  async ngOnInit() {
    this.presetId = this.route.snapshot.paramMap.get('id') ?? '';
    const res = await this.api.listPropias(this.presetId);
    this.propias.set(res.propias ?? []);
  }

  agregar() {
    this.guardado.set(false);
    this.propias.update((qs) => [
      ...qs,
      { code: siguienteCodigoPropio(qs), label: '', type: 'TEXTO_CORTO' as TipoPropia, ayuda: null, required: false, options: null },
    ]);
  }

  quitar(code: string) {
    this.guardado.set(false);
    this.propias.update((qs) => qs.filter((q) => q.code !== code));
  }

  editar(code: string, campo: 'label' | 'ayuda', valor: string) {
    this.guardado.set(false);
    this.propias.update((qs) =>
      qs.map((q) => (q.code === code ? { ...q, [campo]: campo === 'ayuda' ? (valor || null) : valor } : q)),
    );
  }

  /**
   * Cambiar de tipo limpia las opciones cuando el tipo nuevo no las lleva. Guardarlas
   * "por si acaso" hace que el servidor rechace el formulario entero con un error que el
   * médico no puede ver ni corregir desde la pantalla.
   */
  cambiarTipo(code: string, type: TipoPropia) {
    this.guardado.set(false);
    this.propias.update((qs) =>
      qs.map((q) => {
        if (q.code !== code) return q;
        const lleva = type === 'SELECCION_UNICA' || type === 'SELECCION_MULTIPLE';
        return { ...q, type, options: lleva ? (q.options?.length ? q.options : ['']) : null };
      }),
    );
  }

  agregarOpcion(code: string) {
    this.propias.update((qs) =>
      qs.map((q) => (q.code === code ? { ...q, options: [...(q.options ?? []), ''] } : q)),
    );
  }

  editarOpcion(code: string, i: number, valor: string) {
    this.propias.update((qs) =>
      qs.map((q) =>
        q.code === code ? { ...q, options: (q.options ?? []).map((o, j) => (j === i ? valor : o)) } : q,
      ),
    );
  }

  quitarOpcion(code: string, i: number) {
    this.propias.update((qs) =>
      qs.map((q) => (q.code === code ? { ...q, options: (q.options ?? []).filter((_, j) => j !== i) } : q)),
    );
  }

  async guardar() {
    this.guardando.set(true);
    this.errores.set([]);
    try {
      // Las opciones vacías se descartan antes de enviar: son filas que el médico añadió y no
      // llegó a llenar, no una opción en blanco que quiera mostrarle al paciente.
      const limpias = this.propias().map((q) => ({
        ...q,
        label: q.label.trim(),
        options: q.options ? q.options.map((o) => o.trim()).filter(Boolean) : null,
      }));
      const res = await this.api.savePropias(this.presetId, limpias);
      if (res.errores?.length) {
        this.errores.set(res.errores);
      } else {
        this.guardado.set(true);
      }
    } catch (e: any) {
      this.errores.set([mensajeDeError(e)]);
    } finally {
      this.guardando.set(false);
    }
  }
}

/**
 * Un error del servidor en lenguaje del médico. Zod devuelve rutas como `[0].options`, que no
 * le dicen nada a quien está mirando la pantalla.
 */
function mensajeDeError(e: any): string {
  const detalle = e?.error?.issues?.[0]?.message ?? e?.error?.error;
  return detalle
    ? `No se pudo guardar: ${detalle}`
    : 'No se pudo guardar. Revisa que cada pregunta tenga enunciado, y que las de selección tengan opciones.';
}
