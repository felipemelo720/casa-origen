import 'server-only';

import pino, { type Logger } from 'pino';

import { env, isProduction } from '@/config/env';

/**
 * Structured application logger.
 *
 * Production emits newline-delimited JSON on stdout so Docker/journald can
 * ship it verbatim; development pretty-prints. Sensitive paths are redacted
 * at the transport level, never at the call site.
 */
const redactPaths = [
  'password',
  '*.password',
  'confirmPassword',
  '*.confirmPassword',
  'token',
  '*.token',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.cookie',
  'secret',
  '*.secret',
];

const baseLogger: Logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: '[redacted]' },
  base: { service: 'casa-origen', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname,service,env',
          },
        },
      }),
});

export const logger = baseLogger;

/** Returns a child logger tagged with the emitting module. */
export function createLogger(module: string): Logger {
  return baseLogger.child({ module });
}
