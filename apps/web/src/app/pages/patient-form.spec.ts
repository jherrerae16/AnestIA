import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { QUESTION_DICTIONARY, type QuestionDef, type ScheduleFacts } from '@anestia/shared';
import { PatientFormPage } from './patient-form.page';
import { ApiService } from '../core/api.service';

/**
 * El formulario del paciente, montado de verdad.
 *
 * `buildScreens`, `pruneHiddenAnswers` y `summaryRows` viven en `@anestia/shared` y están
 * cubiertos allí. Lo que estos tests cubren es lo otro: que el componente RENDERICE cada tipo de
 * pregunta con el control que le corresponde y que el recorrido avance. Los dos bugs peores del
 * formulario fueron exactamente de esa capa:
 *
 *  - `ARCHIVO` no tenía rama en el `@switch` y caía al `@default`: al paciente se le pedía subir
 *    un examen y le aparecía una caja de texto.
 *  - El `@for` interno del repetidor sombreaba el `$index` de la fila, así que la dosis se
 *    escribía en otra fila y la frecuencia creaba una tercera vacía.
 *
 * Ninguno de los dos lo ve un test de `shared`: allí las pantallas salían perfectas.
 */

/**
 * El diccionario real como lo entrega el servidor: sólo lo que responde el PACIENTE (`fuente: 'P'`).
 * Las de la agenda (`'S'`) no se le envían nunca — es la regla que motivó separar las dos cosas.
 */
const PREGUNTAS_PACIENTE: QuestionDef[] = QUESTION_DICTIONARY.filter((q) => q.fuente === 'P').map(
  (q) => ({
    code: q.code,
    order: q.order,
    label: q.label,
    type: q.type,
    required: q.obligacion === 'O',
    obligacion: q.obligacion,
    seccion: q.seccion,
    grupo: q.grupo ?? null,
    modulo: q.modulo ?? null,
    ayuda: q.ayuda ?? null,
    alimenta: [...(q.alimenta ?? [])],
    options: q.opciones ? [...q.opciones] : null,
    repiteSobre: q.repiteSobre ?? null,
    campos: q.campos ? JSON.parse(JSON.stringify(q.campos)) : null,
    conditional: q.activacion ? JSON.parse(JSON.stringify(q.activacion)) : null,
    validacion: q.validacion ? JSON.parse(JSON.stringify(q.validacion)) : null,
  }) as QuestionDef,
);

/** Agenda de una cirugía mayor: abre Caprini y el DASI completo. */
const AGENDA_MAYOR: ScheduleFacts = {
  especialidad: 'CIRUGIA_GENERAL',
  modalidad: 'HOSPITALARIA',
  prioridad: 'ELECTIVA',
  sitioQuirurgico: 'ABDOMINAL_SUPERIOR',
  duracionEstimada: 'MAS_3H',
  anestesiaProbable: 'GENERAL',
  altoRiesgoRcri: false,
  opioidesPostop: true,
};

/** Una respuesta con la forma real: valor + tipo declarado, igual que la guarda el servidor. */
const nacido = (iso: string) => ({ ID03: { value: iso, type: 'FECHA' as const } });

interface Opciones {
  answers?: Record<string, unknown>;
  procedureDate?: string;
  schedule?: ScheduleFacts | null;
  consentAccepted?: boolean;
}

const api = {
  getForm: vi.fn(),
  acceptConsent: vi.fn().mockResolvedValue(undefined),
  savePartial: vi.fn().mockResolvedValue(undefined),
  submit: vi.fn().mockResolvedValue({ ok: true }),
  upload: vi.fn().mockResolvedValue({ ok: true }),
};

async function montar(o: Opciones = {}): Promise<ComponentFixture<PatientFormPage>> {
  api.getForm.mockResolvedValue({
    caseId: 'c1',
    branding: { logo: null, doctor: 'Dr. Luquetta' },
    questions: PREGUNTAS_PACIENTE,
    consent: { text: 'Autorizo el tratamiento de mis datos (Ley 1581 de 2012).' },
    answers: o.answers ?? {},
    procedureDate: o.procedureDate ?? '2026-09-15',
    schedule: o.schedule === undefined ? AGENDA_MAYOR : o.schedule,
    consentAccepted: o.consentAccepted ?? true,
    submitted: false,
  });

  TestBed.configureTestingModule({
    imports: [PatientFormPage],
    providers: [
      provideExperimentalZonelessChangeDetection(),
      { provide: ApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['token', 'tok-1']]) } } },
    ],
  });
  const f = TestBed.createComponent(PatientFormPage);
  f.detectChanges();
  // `ngOnInit` es asíncrono: sin vaciar la cola de microtareas, la respuesta del API todavía no
  // llegó y el componente sigue en "cargando".
  await new Promise((r) => setTimeout(r, 0));
  await f.whenStable();
  f.detectChanges();
  return f;
}

const q = (f: ComponentFixture<PatientFormPage>, sel: string) =>
  f.nativeElement.querySelector(sel) as HTMLElement | null;
const qq = (f: ComponentFixture<PatientFormPage>, sel: string) =>
  [...f.nativeElement.querySelectorAll(sel)] as HTMLElement[];

async function estabilizar(f: ComponentFixture<PatientFormPage>) {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

/** El control que DEBE renderizar cada tipo. Un tipo sin rama cae al `@default` y falla aquí. */
const CONTROL_ESPERADO: Record<string, (el: HTMLElement) => boolean> = {
  SI_NO: (el) => el.querySelectorAll('[role="radio"]').length === 2,
  SI_NO_NOSABE: (el) => el.querySelectorAll('[role="radio"]').length === 3,
  SELECCION_UNICA: (el) => el.querySelectorAll('[role="radio"]').length > 0,
  SELECCION_MULTIPLE: (el) => el.querySelectorAll('[role="checkbox"]').length > 0,
  ACORDEON_MULTIPLE: (el) => el.querySelectorAll('[role="checkbox"]').length > 0,
  ESCALA_ITEMS: (el) => el.querySelectorAll('[role="radio"]').length > 0,
  REPETIDOR: (el) => !!el.querySelector('.btn-add'),
  ARCHIVO: (el) => !!el.querySelector('input[type="file"]') && !!el.querySelector('.drop-label'),
  TEXTO_LARGO: (el) => !!el.querySelector('textarea'),
  NUMERO: (el) => !!el.querySelector('input[type="number"]'),
  FECHA: (el) => el.querySelector('input')?.getAttribute('placeholder') === 'dd/mm/aaaa',
  TELEFONO: (el) => !!el.querySelector('.phone-wrap select') && !!el.querySelector('input[type="tel"]'),
  DOCUMENTO_ID: (el) => !!el.querySelector('input[type="text"]'),
  CORREO: (el) => !!el.querySelector('input[type="email"]'),
  TEXTO_CORTO: (el) => !!el.querySelector('input[type="text"]'),
};

/**
 * Recorre el formulario entero pulsando "Siguiente" y comprueba pantalla por pantalla.
 * Devuelve los códigos vistos y las pantallas recorridas.
 */
async function recorrer(f: ComponentFixture<PatientFormPage>) {
  const comp = f.componentInstance;
  const vistos: string[] = [];
  let pantallas = 0;

  while (!comp.showSummary() && pantallas < 200) {
    pantallas++;
    for (const bloque of qq(f, '.q')) {
      const code = bloque.id.replace(/^q-/, '');
      vistos.push(code);
      const def = PREGUNTAS_PACIENTE.find((p) => p.code === code);
      if (!def) continue;
      // Una pregunta repetida por enfermedad renderiza una instancia por diagnóstico marcado,
      // no el control base; se comprueba aparte.
      if (bloque.querySelector('.inst')) continue;
      const check = CONTROL_ESPERADO[def.type];
      expect(check, `tipo sin control esperado en el test: ${def.type}`).toBeDefined();
      expect(check!(bloque), `${code} (${def.type}) no renderizó su control`).toBe(true);
    }
    q(f, '[data-testid="form-next"]')!.click();
    await estabilizar(f);
  }
  return { vistos, pantallas };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  TestBed.resetTestingModule();
});

describe('formulario del paciente — recorrido completo', () => {
  it('un adulto recorre el formulario y cada pregunta renderiza su control', async () => {
    const f = await montar({ answers: nacido('1975-04-02') });
    const { vistos, pantallas } = await recorrer(f);

    expect(f.componentInstance.showSummary()).toBe(true);
    expect(pantallas).toBeGreaterThan(15);
    // Sin duplicados: una pregunta que reaparece en dos pantallas es un bucle de navegación.
    expect(new Set(vistos).size).toBe(vistos.length);
  });

  it('NINGUNA pregunta de agenda (PX) llega al paciente', async () => {
    // "El paciente no debe decidir si una cirugía es de alto riesgo, cuánto durará o qué tipo de
    // incisión tendrá." Es la regla que motivó separar la agenda del formulario.
    const f = await montar({ answers: nacido('1975-04-02') });
    const { vistos } = await recorrer(f);
    expect(vistos.filter((c) => /^PX/.test(c))).toEqual([]);
  });

  it('un menor abre la ruta pediátrica y no la de fragilidad', async () => {
    const f = await montar({ answers: nacido('2019-06-01'), procedureDate: '2026-09-15' });
    const { vistos } = await recorrer(f);
    const seccion = (code: string) => PREGUNTAS_PACIENTE.find((p) => p.code === code)?.seccion;
    expect(vistos.some((c) => seccion(c) === 'pediatrico')).toBe(true);
    // FRAIL es de ≥65: en un niño no se pregunta.
    expect(vistos.some((c) => seccion(c) === 'fragilidad')).toBe(false);
  });

  it('un adulto mayor sí ve fragilidad y no ve la sección pediátrica', async () => {
    const f = await montar({ answers: nacido('1948-02-10'), procedureDate: '2026-09-15' });
    const { vistos } = await recorrer(f);
    const seccion = (code: string) => PREGUNTAS_PACIENTE.find((p) => p.code === code)?.seccion;
    expect(vistos.some((c) => seccion(c) === 'fragilidad')).toBe(true);
    expect(vistos.some((c) => seccion(c) === 'pediatrico')).toBe(false);
  });

  it('una cirugía menor recorre menos pantallas que una mayor', async () => {
    const mayor = await recorrer(await montar({ answers: nacido('1975-04-02') }));
    TestBed.resetTestingModule();
    const menor = await recorrer(
      await montar({
        answers: nacido('1975-04-02'),
        schedule: {
          ...AGENDA_MAYOR,
          modalidad: 'AMBULATORIA',
          sitioQuirurgico: 'PERIFERICO',
          duracionEstimada: 'MENOS_2H',
          opioidesPostop: false,
        },
      }),
    );
    expect(menor.pantallas).toBeLessThan(mayor.pantallas);
  });
});

/** Avanza hasta la pantalla que contiene `code`, respondiendo lo que haga falta por el camino. */
async function irA(f: ComponentFixture<PatientFormPage>, code: string) {
  const comp = f.componentInstance;
  for (let i = 0; i < 200 && !comp.showSummary(); i++) {
    if (qq(f, '.q').some((b) => b.id === `q-${code}`)) return;
    q(f, '[data-testid="form-next"]')!.click();
    await estabilizar(f);
  }
  throw new Error(`nunca apareció la pregunta ${code}`);
}

describe('repetidor de medicamentos', () => {
  /**
   * Regresión del peor bug del formulario. El `@for` de campos sombreaba el `$index` de la fila,
   * así que el nombre iba a la fila 0, la dosis a la fila 1 y la frecuencia creaba una fila 2
   * vacía: `[{"nombre":"Losartán"},{"dosis":"50 mg"},{}]`. Se guardaba así, sin error.
   */
  it('los campos de una fila se escriben en ESA fila', async () => {
    const f = await montar({
      answers: { ...nacido('1975-04-02'), RX01: { value: 'si', type: 'SI_NO' } },
    });
    await irA(f, 'RX02');

    q(f, '[data-testid="rep-add-RX02"]')!.click();
    await estabilizar(f);

    for (const [campo, valor] of [['nombre', 'Losartán'], ['dosis', '50 mg'], ['frecuencia', 'cada 12 h']]) {
      const input = q(f, `[data-testid="rep-RX02-0-${campo}"]`) as HTMLInputElement;
      expect(input, `falta el campo ${campo}`).toBeTruthy();
      input.value = valor!;
      input.dispatchEvent(new Event('input'));
      await estabilizar(f);
    }

    const filas = f.componentInstance.repItems('RX02') as Record<string, string>[];
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ nombre: 'Losartán', dosis: '50 mg', frecuencia: 'cada 12 h' });
  });

  it('dos medicamentos no se mezclan entre sí', async () => {
    const f = await montar({
      answers: { ...nacido('1975-04-02'), RX01: { value: 'si', type: 'SI_NO' } },
    });
    await irA(f, 'RX02');

    for (const [fila, nombre] of [[0, 'Losartán'], [1, 'Metformina']] as const) {
      q(f, '[data-testid="rep-add-RX02"]')!.click();
      await estabilizar(f);
      const input = q(f, `[data-testid="rep-RX02-${fila}-nombre"]`) as HTMLInputElement;
      input.value = nombre;
      input.dispatchEvent(new Event('input'));
      await estabilizar(f);
    }

    const filas = f.componentInstance.repItems('RX02') as Record<string, string>[];
    expect(filas.map((r) => r.nombre)).toEqual(['Losartán', 'Metformina']);
  });
});

/** Opciones marcadas de una pregunta múltiple, tal como se guardan. */
const marcadas = (f: ComponentFixture<PatientFormPage>, code: string): string[] => {
  const v = f.componentInstance.answers()[code]?.value;
  return Array.isArray(v) ? v : [];
};

describe('acordeón de antecedentes', () => {
  /** §5: "Ninguna de las anteriores" es excluyente. Marcarla junto a una enfermedad es una
   *  contradicción que llegaría al motor clínico como un hecho. */
  it('"Ninguna de las anteriores" desmarca el resto', async () => {
    const f = await montar({
      answers: { ...nacido('1975-04-02'), AP00: { value: 'si', type: 'SI_NO' } },
    });
    await irA(f, 'AG01');

    const bloque = qq(f, '.q').find((b) => b.id === 'q-AG01')!;
    const opciones = [...bloque.querySelectorAll('[role="checkbox"]')] as HTMLElement[];
    opciones[0]!.click();
    await estabilizar(f);
    expect(marcadas(f, 'AG01')).toHaveLength(1);

    (q(f, '[data-testid="q-AG01-Ninguna de las anteriores"]') as HTMLElement).click();
    await estabilizar(f);
    expect(marcadas(f, 'AG01')).toEqual(['Ninguna de las anteriores']);
  });

  it('marcar una enfermedad después quita "Ninguna"', async () => {
    const f = await montar({
      answers: { ...nacido('1975-04-02'), AP00: { value: 'si', type: 'SI_NO' } },
    });
    await irA(f, 'AG01');

    (q(f, '[data-testid="q-AG01-Ninguna de las anteriores"]') as HTMLElement).click();
    await estabilizar(f);
    const bloque = qq(f, '.q').find((b) => b.id === 'q-AG01')!;
    ([...bloque.querySelectorAll('[role="checkbox"]')] as HTMLElement[])[0]!.click();
    await estabilizar(f);

    const v = marcadas(f, 'AG01');
    expect(v).not.toContain('Ninguna de las anteriores');
    expect(v).toHaveLength(1);
  });
});

describe('autoguardado', () => {
  /** Antes sólo había un botón "Guardar" manual: cerrar la pestaña perdía todo. El espejo en
   *  localStorage es lo que salva al paciente cuando el navegador del móvil mata la pestaña. */
  it('espeja las respuestas en localStorage al responder', async () => {
    const f = await montar({ answers: nacido('1975-04-02') });
    await irA(f, 'ID01');

    const input = q(f, '[data-testid="q-ID01"]') as HTMLInputElement;
    f.componentInstance.setAnswer(
      f.componentInstance.questions().find((x) => x.code === 'ID01')!,
      'Roberto Uribe',
    );
    await estabilizar(f);
    expect(input).toBeTruthy();

    const guardado = JSON.parse(localStorage.getItem('anestia:draft:tok-1') ?? '{}');
    expect(guardado.ID01?.value).toBe('Roberto Uribe');
  });

  it('recupera el borrador local y lo avisa, sin pisar lo que ya tiene el servidor', async () => {
    localStorage.setItem(
      'anestia:draft:tok-1',
      JSON.stringify({
        ...nacido('1975-04-02'),
        ID01: { value: 'lo que alcanzó a escribir', type: 'TEXTO_CORTO' },
      }),
    );
    const f = await montar({
      answers: { ...nacido('1975-04-02'), ID01: { value: 'lo que llegó al servidor', type: 'TEXTO_CORTO' } },
    });

    // El servidor manda; el borrador sólo aporta lo que aún no había llegado.
    expect(f.componentInstance.valueOf('ID01')).toBe('lo que llegó al servidor');
    expect(f.componentInstance.restored()).toBe(false);
  });

  it('lo que sólo existe en el borrador se recupera y se avisa', async () => {
    localStorage.setItem(
      'anestia:draft:tok-1',
      JSON.stringify({ ...nacido('1975-04-02'), ID01: { value: 'sólo local', type: 'TEXTO_CORTO' } }),
    );
    const f = await montar({ answers: {} });
    expect(f.componentInstance.valueOf('ID01')).toBe('sólo local');
    // Se avisa en vez de reaparecer datos sin explicación.
    expect(f.componentInstance.restored()).toBe(true);
  });
});

describe('carga de exámenes', () => {
  /** `ARCHIVO` no tenía rama en el `@switch` y caía al `@default`: se le pedía al paciente subir
   *  un examen y le salía una caja para escribir. */
  it('DC01 renderiza un selector de archivos, no un campo de texto', async () => {
    const f = await montar({ answers: nacido('1975-04-02') });
    await irA(f, 'DC01');
    const bloque = qq(f, '.q').find((b) => b.id === 'q-DC01')!;
    expect(bloque.querySelector('input[type="file"]')).toBeTruthy();
    expect(bloque.querySelector('.drop-label')).toBeTruthy();
    expect(bloque.querySelector('input[type="text"]')).toBeNull();
    expect(bloque.querySelector('textarea')).toBeNull();
  });
});
