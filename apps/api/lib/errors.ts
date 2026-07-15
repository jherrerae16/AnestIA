import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';
import { SessionError } from './auth/session-helper';
import { ApprovedLockError } from './services/approval.service';

/**
 * Manejador global fail-closed (SECURITY-15). Envuelve handlers de rutas:
 * captura cualquier excepción → loguea (sin secretos) → responde genérico.
 * Nunca filtra stack traces ni detalles internos al cliente.
 */
export function apiHandler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: 'Entrada inválida.' },
          { status: 400 },
        );
      }
      if (err instanceof SessionError) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
      }
      if (err instanceof ApprovedLockError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'unhandled_api_error');
      return NextResponse.json(
        { error: 'Ocurrió un error. Intenta de nuevo.' },
        { status: 500 },
      );
    }
  };
}
