import { z } from 'zod';

/** Login del panel (SECURITY-05: validación con bordes de longitud). */
export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const sessionPayloadSchema = z.object({
  anesthesiologistId: z.string(),
  email: z.string().email(),
});
/**
 * `emitidaEn` es el `iat` del JWT, en segundos. No se firma como parte del contrato — lo pone
 * la librería — pero se necesita para invalidar las sesiones anteriores a un cambio de
 * contraseña. `null` cuando el token no lo trae.
 */
export type SessionPayload = z.infer<typeof sessionPayloadSchema> & { emitidaEn?: number | null };

/**
 * Política de contraseña. Deliberadamente simple: longitud mínima y nada más.
 *
 * Las reglas de composición (una mayúscula, un símbolo) empujan a la gente hacia
 * `Clinica2026!` y hacia el papelito bajo el teclado. Lo que protege de verdad es la longitud,
 * y el hashing con argon2id que ya está.
 */
export const PASSWORD_MIN = 10;

export const cambiarPasswordSchema = z
  .object({
    actual: z.string().min(1, 'Escribe tu contraseña actual.'),
    nueva: z.string().min(PASSWORD_MIN, `La contraseña nueva necesita al menos ${PASSWORD_MIN} caracteres.`).max(200),
  })
  .refine((v) => v.actual !== v.nueva, {
    path: ['nueva'],
    message: 'La contraseña nueva tiene que ser distinta de la actual.',
  });
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;

/** Solicitud de restablecimiento. Se responde igual exista o no el correo. */
export const olvidePasswordSchema = z.object({
  email: z.string().email().max(254),
});
export type OlvidePasswordInput = z.infer<typeof olvidePasswordSchema>;

export const restablecerPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  nueva: z.string().min(PASSWORD_MIN, `La contraseña necesita al menos ${PASSWORD_MIN} caracteres.`).max(200),
});
export type RestablecerPasswordInput = z.infer<typeof restablecerPasswordSchema>;

/** Vigencia de un enlace de restablecimiento. Corta a propósito: es un correo, no una sesión. */
export const RESET_TTL_MINUTOS = 60;
