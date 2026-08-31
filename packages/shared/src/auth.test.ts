import { describe, it, expect } from 'vitest';
import {
  cambiarPasswordSchema,
  restablecerPasswordSchema,
  olvidePasswordSchema,
  PASSWORD_MIN,
  RESET_TTL_MINUTOS,
} from './auth';

/**
 * Bordes de contraseña. Aparecieron al abrir el alta manual de anestesiólogos: con un solo
 * usuario daba igual, pero en cuanto entra un colega con una clave generada hace falta que
 * pueda ponerse la suya y recuperarla sin depender de nadie.
 */

describe('cambiar contraseña', () => {
  const ok = { actual: 'la-de-siempre', nueva: 'una-nueva-larga' };

  it('acepta un cambio normal', () => {
    expect(cambiarPasswordSchema.safeParse(ok).success).toBe(true);
  });

  it('exige la actual', () => {
    // Sin ella, una sesión robada o un equipo desbloqueado bastan para tomar la cuenta.
    expect(cambiarPasswordSchema.safeParse({ ...ok, actual: '' }).success).toBe(false);
  });

  it('rechaza una nueva más corta que el mínimo', () => {
    const corta = 'a'.repeat(PASSWORD_MIN - 1);
    expect(cambiarPasswordSchema.safeParse({ ...ok, nueva: corta }).success).toBe(false);
    expect(cambiarPasswordSchema.safeParse({ ...ok, nueva: corta + 'a' }).success).toBe(true);
  });

  it('rechaza repetir la misma contraseña', () => {
    const r = cambiarPasswordSchema.safeParse({ actual: 'misma-clave-larga', nueva: 'misma-clave-larga' });
    expect(r.success).toBe(false);
  });

  it('el mensaje de error es para el médico, no para el validador', () => {
    const r = cambiarPasswordSchema.safeParse({ actual: 'x', nueva: 'corta' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.message).toContain('caracteres');
  });
});

describe('restablecer', () => {
  it('exige token y contraseña con el mínimo', () => {
    const token = 'a'.repeat(43);
    expect(restablecerPasswordSchema.safeParse({ token, nueva: 'una-nueva-larga' }).success).toBe(true);
    expect(restablecerPasswordSchema.safeParse({ token: 'corto', nueva: 'una-nueva-larga' }).success).toBe(false);
  });

  it('el enlace no vale un día entero', () => {
    // Es un correo, no una sesión: cuanto más vive, más tiempo es una llave suelta.
    expect(RESET_TTL_MINUTOS).toBeLessThanOrEqual(60);
  });

  it('solicitar sólo pide un correo válido', () => {
    expect(olvidePasswordSchema.safeParse({ email: 'ana@clinica.co' }).success).toBe(true);
    expect(olvidePasswordSchema.safeParse({ email: 'no-es-correo' }).success).toBe(false);
  });
});
