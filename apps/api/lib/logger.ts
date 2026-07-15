import pino from 'pino';

/**
 * Logger estructurado (SECURITY-03). Redacta campos sensibles: nunca loguear
 * contraseñas, tokens, hashes ni cookies.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['password', 'passwordHash', 'token', 'authorization', 'cookie', 'set-cookie', '*.password', '*.token'],
    censor: '[redacted]',
  },
});
