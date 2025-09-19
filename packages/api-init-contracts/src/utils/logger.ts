import pino from 'pino';

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

const VALID_LOG_LEVELS: Set<LogLevel> = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

function resolveLogLevel(rawLevel: string | undefined, fallback: LogLevel): LogLevel {
  if (!rawLevel) {
    return fallback;
  }

  const normalized = rawLevel.toLowerCase();
  const directMatch = normalized.trim() as LogLevel;
  if (VALID_LOG_LEVELS.has(directMatch)) {
    return directMatch;
  }

  const match = normalized.match(/(fatal|error|warn|info|debug|trace|silent)/);
  if (match && VALID_LOG_LEVELS.has(match[1] as LogLevel)) {
    return match[1] as LogLevel;
  }

  process.emitWarning(
    `Ignoring unsupported LOG_LEVEL value "${rawLevel}". Falling back to "${fallback}".`,
    'InvalidLogLevelWarning',
  );

  return fallback;
}

const isVitest = process.env.VITEST === 'true';
const NODE_ENV = process.env.NODE_ENV || (isVitest ? 'test' : 'development');
const DEFAULT_LEVEL: LogLevel = isVitest || NODE_ENV === 'test' ? 'warn' : 'info';
const LOG_LEVEL = resolveLogLevel(process.env.LOG_LEVEL, DEFAULT_LEVEL);

export const logger = pino({
  level: LOG_LEVEL,
  transport:
    NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
});

export default logger;
