/**
 * How much the reader is meant to care, in libsession's six levels.
 *
 * Six rather than the console's four because the level is a field of the line: an adapter that
 * folds `critical` into `error` on the way through erases the one distinction somebody reading a
 * crash report needed.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical'

export const LOG_LEVELS: readonly LogLevel[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'critical',
]

/** Five columns each, so the category after it always starts in the same place. */
const WORDS: Record<LogLevel, string> = {
  trace: 'TRACE',
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  critical: 'CRIT ',
}

export function levelWord(level: LogLevel): string {
  return WORDS[level]
}

export function levelRank(level: LogLevel): number {
  return LOG_LEVELS.indexOf(level)
}

/** A level named in text, or undefined - libsession's names and this module's are the same. */
export function parseLevel(text: string): LogLevel | undefined {
  return (LOG_LEVELS as readonly string[]).includes(text) ? (text as LogLevel) : undefined
}
