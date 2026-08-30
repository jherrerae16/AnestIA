import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ReviewApprovalPage } from './review-approval.page';
import { ApiService } from '../core/api.service';

/**
 * La pantalla de revisión — la que firma el anestesiólogo.
 *
 * Lo que se cubre aquí no es la lógica de aprobación (vive en `@anestia/shared` y está probada),
 * sino que el médico **vea** lo que tiene que ver antes de firmar. El defecto que motivó estos
 * tests: un laboratorio retenido por confianza baja no alimentaba escalas y la revisión no lo
 * mostraba por ninguna parte. El dato desaparecía en silencio y no había forma de rescatarlo.
 */

const LAB_OK = {
  id: 'lab-ok',
  analyte: 'Creatinina',
  value: '0.9',
  unit: 'mg/dL',
  grupo: 'quimica',
  refRange: '0.7 - 1.3',
  flag: 'NORMAL',
  manualFlag: null,
  effectiveFlag: 'NORMAL',
  rangeUnparsed: false,
  estadoExtraccion: 'AUTOMATICO',
  confidence: 0.96,
  identityMatch: 'COINCIDE',
};

const LAB_DUDOSO = {
  ...LAB_OK,
  id: 'lab-dudoso',
  analyte: 'Hemoglobina',
  value: '9.8',
  unit: 'g/dL',
  grupo: 'hemograma',
  flag: 'ALERTA',
  effectiveFlag: 'ALERTA',
  estadoExtraccion: 'PENDIENTE_CONFIRMACION',
  confidence: 0.42,
};

const ECG_DUDOSO = {
  id: 'est-1',
  tipo: 'ECG',
  titulo: 'EKG de 12 derivaciones',
  texto: 'EKG de 12 derivaciones: ritmo sinusal; frecuencia 58 lpm. Conclusión: Bradicardia sinusal.',
  fecha: '2026-08-12',
  estadoExtraccion: 'PENDIENTE_CONFIRMACION',
  confidence: 0.5,
  identityMatch: 'NO_VERIFICABLE',
};

const api = {
  getReview: vi.fn(),
  previewUrl: vi.fn().mockReturnValue('/api/preview/c1'),
  confirmarLectura: vi.fn().mockResolvedValue({ estadoExtraccion: 'CONFIRMADO' }),
  setLabVerdict: vi.fn().mockResolvedValue({ manualFlag: 'NORMAL', effectiveFlag: 'NORMAL' }),
  listContacts: vi.fn().mockResolvedValue({ contacts: [] }),
  reaudit: vi.fn().mockResolvedValue({ audit: { findings: [] } }),
};

interface Opciones {
  labs?: unknown[];
  estudios?: unknown[];
  escalas?: unknown[];
  canApprove?: { ok: boolean; blockers: string[] };
}

function respuesta(o: Opciones = {}) {
  return {
    fields: {
      identificacion: { nombre: { valor: 'Roberto Uribe', estado: 'ok', fuente: 'formulario:ID01' } },
      paraclinicos: {},
    },
    labs: o.labs ?? [LAB_OK],
    estudios: o.estudios ?? [],
    labGroups: [],
    attachments: [],
    escalas: o.escalas ?? [],
    canApprove: o.canApprove ?? { ok: true, blockers: [] },
    patient: { fullName: 'Roberto Uribe', email: null },
    agendaFaltante: [],
    schedule: null,
    patientNote: null,
    patientId: 'p1',
    audit: { findings: [] },
    approved: false,
    status: 'EN_REVISION',
  };
}

async function montar(o: Opciones = {}): Promise<ComponentFixture<ReviewApprovalPage>> {
  api.getReview.mockResolvedValue(respuesta(o));
  TestBed.configureTestingModule({
    imports: [ReviewApprovalPage],
    providers: [
      provideExperimentalZonelessChangeDetection(),
      { provide: ApiService, useValue: api },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'c1']]) } } },
    ],
  });
  const f = TestBed.createComponent(ReviewApprovalPage);
  f.detectChanges();
  await new Promise((r) => setTimeout(r, 0));
  await f.whenStable();
  f.detectChanges();
  return f;
}

const q = (f: ComponentFixture<ReviewApprovalPage>, sel: string) =>
  f.nativeElement.querySelector(sel) as HTMLElement | null;
const qq = (f: ComponentFixture<ReviewApprovalPage>, sel: string) =>
  [...f.nativeElement.querySelectorAll(sel)] as HTMLElement[];

beforeEach(() => {
  vi.clearAllMocks();
  api.previewUrl.mockReturnValue('/api/preview/c1');
  api.confirmarLectura.mockResolvedValue({ estadoExtraccion: 'CONFIRMADO' });
  api.listContacts.mockResolvedValue({ contacts: [] });
  TestBed.resetTestingModule();
});

describe('lecturas retenidas', () => {
  it('sin lecturas dudosas no aparece el aviso', async () => {
    const f = await montar();
    expect(q(f, '[data-testid="labs-retenidos"]')).toBeNull();
  });

  it('un laboratorio retenido se avisa y dice por qué', async () => {
    const f = await montar({ labs: [LAB_OK, LAB_DUDOSO] });
    const aviso = q(f, '[data-testid="labs-retenidos"]');
    expect(aviso).toBeTruthy();
    expect(aviso!.textContent).toContain('1 lectura');
    // El motivo cambia lo que el médico hace: una confianza baja se resuelve mirando el PDF.
    expect(f.nativeElement.textContent).toContain('lectura dudosa (42 %)');
  });

  it('una identidad discordante se nombra como tal, no como "lectura dudosa"', async () => {
    // Es el caso peligroso: puede ser el examen de un familiar.
    const f = await montar({
      labs: [{ ...LAB_DUDOSO, confidence: 0.95, identityMatch: 'NO_COINCIDE' }],
    });
    expect(f.nativeElement.textContent).toContain('el informe parece de otro paciente');
  });

  it('confirmar una lectura la manda al servidor y recarga el caso', async () => {
    const f = await montar({ labs: [LAB_DUDOSO] });
    const boton = q(f, '[data-testid="confirmar-lab-lab-dudoso"]');
    expect(boton).toBeTruthy();

    api.getReview.mockResolvedValue(
      respuesta({ labs: [{ ...LAB_DUDOSO, estadoExtraccion: 'CONFIRMADO' }] }),
    );
    boton!.click();
    await new Promise((r) => setTimeout(r, 0));
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    expect(api.confirmarLectura).toHaveBeenCalledWith('c1', 'lab', 'lab-dudoso', true);
    // Se recarga porque el servidor recalcula las escalas que esperaban ese dato.
    expect(api.getReview).toHaveBeenCalledTimes(2);
    expect(q(f, '[data-testid="labs-retenidos"]')).toBeNull();
    expect(f.nativeElement.textContent).toContain('lectura confirmada');
  });

  it('una lectura ya automática no ofrece confirmar', async () => {
    const f = await montar({ labs: [LAB_OK] });
    expect(q(f, '[data-testid="confirmar-lab-lab-ok"]')).toBeNull();
  });
});

describe('estudios no-laboratorio', () => {
  it('un ECG se muestra transcrito', async () => {
    const f = await montar({ estudios: [ECG_DUDOSO] });
    const filas = qq(f, '[data-testid="estudio-row"]');
    expect(filas).toHaveLength(1);
    expect(filas[0]!.textContent).toContain('EKG de 12 derivaciones');
    expect(filas[0]!.textContent).toContain('Bradicardia sinusal');
  });

  it('un estudio sin confirmar se puede confirmar', async () => {
    const f = await montar({ estudios: [ECG_DUDOSO] });
    q(f, '[data-testid="confirmar-estudio-est-1"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(api.confirmarLectura).toHaveBeenCalledWith('c1', 'estudio', 'est-1', true);
  });

  it('sin estudios no se dibuja la sección', async () => {
    const f = await montar();
    expect(qq(f, '[data-testid="estudio-row"]')).toHaveLength(0);
  });
});

describe('lo que bloquea la firma se ve', () => {
  it('los bloqueantes se muestran al médico', async () => {
    const f = await montar({
      canApprove: { ok: false, blockers: ['Examen físico pendiente', 'Escala en revisión clínica'] },
    });
    expect(f.nativeElement.textContent).toContain('Examen físico pendiente');
    expect(f.nativeElement.textContent).toContain('Escala en revisión clínica');
  });

  it('una escala con puntaje pero sin categoría no inventa interpretación', async () => {
    // Los cortes están SIN_VALIDAR: se publica el número y se retiene la categoría.
    const f = await montar({
      escalas: [
        {
          escala: 'ARISCAT',
          nombre: 'ARISCAT — riesgo pulmonar',
          version: 'ARISCAT@1',
          cortesVersion: null,
          estado: 'CALCULADA',
          puntaje: 45,
          categoria: null,
          variables: [],
          faltantes: [],
          motivo: null,
          resueltoPor: null,
          resueltoAt: null,
        },
      ],
    });
    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('45');
    expect(texto).not.toContain('Riesgo alto');
  });
});
