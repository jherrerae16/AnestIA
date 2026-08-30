import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { PresetEditorPage } from './preset-editor.page';
import { ApiService } from '../core/api.service';

/**
 * Editor de las preguntas propias del médico.
 *
 * Lo que estos tests protegen es el límite: la pantalla añade preguntas suyas y **no** ofrece
 * ninguna forma de tocar las de la Especificación. El servidor lo hace estructuralmente
 * imposible; aquí se comprueba que la interfaz tampoco lo insinúe.
 */

const api = {
  listPropias: vi.fn(),
  savePropias: vi.fn(),
};

async function montar(propias: unknown[] = []): Promise<ComponentFixture<PresetEditorPage>> {
  api.listPropias.mockResolvedValue({ propias });
  TestBed.configureTestingModule({
    imports: [PresetEditorPage],
    providers: [
      provideExperimentalZonelessChangeDetection(),
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'preset-1']]) } } },
    ],
  });
  const f = TestBed.createComponent(PresetEditorPage);
  f.detectChanges();
  await new Promise((r) => setTimeout(r, 0));
  await f.whenStable();
  f.detectChanges();
  return f;
}

const q = (f: ComponentFixture<PresetEditorPage>, sel: string) =>
  f.nativeElement.querySelector(sel) as HTMLElement | null;

async function estabilizar(f: ComponentFixture<PresetEditorPage>) {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

beforeEach(() => {
  vi.clearAllMocks();
  api.savePropias.mockResolvedValue({ errores: [], guardadas: 1 });
  TestBed.resetTestingModule();
});

describe('editor de preguntas propias', () => {
  it('empieza vacío y lo dice', async () => {
    const f = await montar();
    expect(q(f, '[data-testid="editor-vacio"]')).toBeTruthy();
  });

  it('deja claro que la Especificación no se edita aquí', async () => {
    const f = await montar();
    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('no se editan aquí');
    expect(texto).toContain('no alimentan ninguna escala');
  });

  it('añadir una pregunta le asigna el siguiente código propio', async () => {
    const f = await montar();
    q(f, '[data-testid="agregar-propia"]')!.click();
    await estabilizar(f);
    expect(q(f, '[data-testid="propia-PR01"]')).toBeTruthy();

    q(f, '[data-testid="agregar-propia"]')!.click();
    await estabilizar(f);
    expect(q(f, '[data-testid="propia-PR02"]')).toBeTruthy();
  });

  it('cambiar a un tipo de selección abre las opciones', async () => {
    const f = await montar();
    q(f, '[data-testid="agregar-propia"]')!.click();
    await estabilizar(f);
    expect(q(f, '[data-testid="opcion-PR01-0"]')).toBeNull();

    f.componentInstance.cambiarTipo('PR01', 'SELECCION_UNICA');
    await estabilizar(f);
    expect(q(f, '[data-testid="opcion-PR01-0"]')).toBeTruthy();
  });

  it('volver a un tipo sin opciones las descarta', async () => {
    // Guardarlas "por si acaso" hace que el servidor rechace el formulario entero con un error
    // que el médico no puede ver ni corregir desde la pantalla.
    const f = await montar();
    q(f, '[data-testid="agregar-propia"]')!.click();
    await estabilizar(f);
    f.componentInstance.cambiarTipo('PR01', 'SELECCION_MULTIPLE');
    f.componentInstance.editarOpcion('PR01', 0, 'WhatsApp');
    f.componentInstance.cambiarTipo('PR01', 'TEXTO_CORTO');
    await estabilizar(f);
    expect(f.componentInstance.propias()[0]!.options).toBeNull();
  });

  it('guardar envía las preguntas limpias, sin opciones en blanco', async () => {
    const f = await montar();
    q(f, '[data-testid="agregar-propia"]')!.click();
    await estabilizar(f);
    f.componentInstance.editar('PR01', 'label', '  ¿Quién lo acompaña?  ');
    f.componentInstance.cambiarTipo('PR01', 'SELECCION_UNICA');
    f.componentInstance.editarOpcion('PR01', 0, 'Un familiar');
    f.componentInstance.agregarOpcion('PR01');
    await estabilizar(f);

    q(f, '[data-testid="guardar-propias"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    await estabilizar(f);

    expect(api.savePropias).toHaveBeenCalledWith('preset-1', [
      expect.objectContaining({
        code: 'PR01',
        label: '¿Quién lo acompaña?',
        type: 'SELECCION_UNICA',
        options: ['Un familiar'],
      }),
    ]);
    expect(f.nativeElement.textContent).toContain('Guardado');
  });

  it('los errores del servidor se muestran, no se tragan', async () => {
    api.savePropias.mockResolvedValue({ errores: ['El código PR01 está repetido.'], guardadas: 0 });
    const f = await montar();
    q(f, '[data-testid="agregar-propia"]')!.click();
    await estabilizar(f);
    q(f, '[data-testid="guardar-propias"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    await estabilizar(f);

    expect(q(f, '[data-testid="editor-errores"]')!.textContent).toContain('repetido');
    expect(f.nativeElement.textContent).not.toContain('✔ Guardado');
  });

  it('un fallo de red no se queda en "Guardando…"', async () => {
    api.savePropias.mockRejectedValue({ error: { error: 'Sin sesión' } });
    const f = await montar();
    q(f, '[data-testid="agregar-propia"]')!.click();
    await estabilizar(f);
    q(f, '[data-testid="guardar-propias"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    await estabilizar(f);

    expect(f.componentInstance.guardando()).toBe(false);
    expect(q(f, '[data-testid="editor-errores"]')!.textContent).toContain('Sin sesión');
  });

  it('quitar una pregunta la saca de la lista', async () => {
    const f = await montar([
      { code: 'PR01', label: 'Una', type: 'TEXTO_CORTO', ayuda: null, required: false, options: null },
    ]);
    expect(q(f, '[data-testid="propia-PR01"]')).toBeTruthy();
    q(f, '[data-testid="quitar-PR01"]')!.click();
    await estabilizar(f);
    expect(q(f, '[data-testid="propia-PR01"]')).toBeNull();
  });
});
