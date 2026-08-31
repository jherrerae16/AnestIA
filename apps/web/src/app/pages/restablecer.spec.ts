import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RestablecerPage } from './restablecer.page';
import { ApiService } from '../core/api.service';

/** La pantalla a la que llega el médico desde el correo, sin sesión. */

const api = { restablecerPassword: vi.fn() };
const router = { navigate: vi.fn() };

async function montar(token: string | null): Promise<ComponentFixture<RestablecerPage>> {
  TestBed.configureTestingModule({
    imports: [RestablecerPage],
    providers: [
      provideExperimentalZonelessChangeDetection(),
      { provide: ApiService, useValue: api },
      { provide: Router, useValue: router },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: new Map(token ? [['token', token]] : []) } },
      },
    ],
  });
  const f = TestBed.createComponent(RestablecerPage);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}

const q = (f: ComponentFixture<RestablecerPage>, sel: string) =>
  f.nativeElement.querySelector(sel) as HTMLElement | null;

async function estabilizar(f: ComponentFixture<RestablecerPage>) {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

beforeEach(() => {
  vi.clearAllMocks();
  api.restablecerPassword.mockResolvedValue({ ok: true });
  TestBed.resetTestingModule();
});

describe('restablecer contraseña', () => {
  it('sin token no muestra el formulario, y explica qué hacer', async () => {
    const f = await montar(null);
    expect(q(f, '[data-testid="reset-sin-token"]')).toBeTruthy();
    expect(q(f, '[data-testid="reset-nueva"]')).toBeNull();
  });

  it('con token pide la contraseña nueva', async () => {
    const f = await montar('un-token-largo-de-prueba-1234567890');
    expect(q(f, '[data-testid="reset-nueva"]')).toBeTruthy();
  });

  it('el botón no se habilita con una contraseña corta', async () => {
    const f = await montar('un-token-largo-de-prueba-1234567890');
    f.componentInstance.nueva.set('corta');
    await estabilizar(f);
    expect((q(f, '[data-testid="reset-guardar"]') as HTMLButtonElement).disabled).toBe(true);

    f.componentInstance.nueva.set('una-contraseña-larga');
    await estabilizar(f);
    expect((q(f, '[data-testid="reset-guardar"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('al guardar bien confirma y ofrece iniciar sesión', async () => {
    const f = await montar('un-token-largo-de-prueba-1234567890');
    f.componentInstance.nueva.set('una-contraseña-larga');
    await estabilizar(f);
    q(f, '[data-testid="reset-guardar"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    await estabilizar(f);

    expect(api.restablecerPassword).toHaveBeenCalledWith(
      'un-token-largo-de-prueba-1234567890',
      'una-contraseña-larga',
    );
    expect(q(f, '[data-testid="reset-ok"]')).toBeTruthy();
    // La contraseña nueva no se queda escrita en pantalla.
    expect(f.componentInstance.nueva()).toBe('');
  });

  it('un token vencido se dice con el mensaje del servidor', async () => {
    api.restablecerPassword.mockRejectedValue({
      error: { error: 'El enlace no es válido o ya venció. Pide uno nuevo.' },
    });
    const f = await montar('un-token-largo-de-prueba-1234567890');
    f.componentInstance.nueva.set('una-contraseña-larga');
    await estabilizar(f);
    q(f, '[data-testid="reset-guardar"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    await estabilizar(f);

    expect(q(f, '[data-testid="reset-error"]')!.textContent).toContain('ya venció');
    expect(q(f, '[data-testid="reset-ok"]')).toBeNull();
    expect(f.componentInstance.guardando()).toBe(false);
  });
});
