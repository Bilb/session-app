import type { LogLevel } from './level'

/** spdlog's level names, which libsession's lines carry, onto the app's. */
const LEVELS: Readonly<Record<string, LogLevel>> = {
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  warning: 'warn',
  err: 'error',
  error: 'error',
  critical: 'critical',
}

/** Anything libsession might send that is not a level it has named is written as `info`. */
function appLevel(level: string): LogLevel {
  return LEVELS[level] ?? 'info'
}

/**
 * libsession's own prefix: `[2026-10-08 17:55:06] [+0.420s] [core.gbl:info|core/globals.cpp:150] `,
 * its uptime written `+3m50.208s` past a minute and `+1h03m50.208s` past an hour, with no larger
 * unit after that (`+26h03m07.120s`) - oxen-logging's `startup_elapsed_flag`.
 *
 * The local time and uptime repeat the app's own columns in another zone and from another zero,
 * so they are dropped. The level in it is the one the line was logged at, which the event's own
 * field does not always agree with; the source location is kept, at the end, as `src=`.
 */
const LIBSESSION_PREFIX =
  /^\[[^\]]*\] \[\+(?:\d+h)?(?:\d+m)?[\d.]+s\] \[[^:|\]]+:([a-z]+)\|([^\]]+)\] /

const REQUEST_TAG = /^\[Request ([\w-]+)\] /

/** One of libsession's lines as the app writes it: its real level, and the message alone. */
export function libsessionLine(
  level: string,
  message: string,
): { level: LogLevel; message: string; op?: string } {
  const trimmed = message.replace(/\s+$/, '')
  const prefix = LIBSESSION_PREFIX.exec(trimmed)
  if (prefix === null) return { level: appLevel(level), message: trimmed }
  const body = trimmed.slice(prefix[0].length)
  // libsession tags each request's lines `[Request CoS-0-GZHC]`, under both transports: the
  // operation id the app's op column exists for.
  const request = REQUEST_TAG.exec(body)
  const text = request === null ? body : body.slice(request[0].length)
  return {
    level: appLevel(prefix[1] ?? level),
    message: `${text} src=${prefix[2] ?? ''}`,
    ...(request?.[1] === undefined ? {} : { op: request[1] }),
  }
}
