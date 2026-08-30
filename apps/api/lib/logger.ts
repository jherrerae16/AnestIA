import pino from 'pino';

/**
 * Logger estructurado (SECURITY-03). Redacta campos sensibles: nunca loguear
 * contraseñas, tokens, hashes ni cookies.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'password', 'passwordHash', 'token', 'authorization', 'cookie', 'set-cookie',
      '*.password', '*.token',
      // La key nunca se loguea a propósito, pero un objeto de error del SDK puede arrastrar la
      // cabecera de la petición. Redactarla aquí cuesta nada y cierra esa vía.
      'apiKey', '*.apiKey', 'x-api-key', '*.x-api-key', 'headers.authorization', 'headers["x-api-key"]',
    ],
    censor: '[redacted]',
  },
});
