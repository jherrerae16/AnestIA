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
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
