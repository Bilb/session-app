import { parseLogSpec } from '@session/basic-types'

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

/** What the file keeps of any category when no spec asks for more. */
const DEFAULT_MIN_LEVEL: LogLevel = 'info'

/**
 * The quietest level the file keeps for each category, from the spec libsession is opened with
 * (`EXPO_PUBLIC_SESSION_LOG`, `warn,network=debug`), so the one setting that makes libsession emit
 * a line is also what keeps it.
 *
 * A spec only adds detail: a category keeps the more verbose of `info` and what the spec says for
 * it, its own pair or else the bare level. A quiet spec is meant for libsession's firehose, and
 * does not take the app's own lines below what every log keeps.
 */
export function minLevelFromSpec(spec: string | undefined): (category: string) => LogLevel {
  const parsed = parseLogSpec(spec)
  const floor = (level: LogLevel | undefined): LogLevel =>
    level !== undefined && levelRank(level) < levelRank(DEFAULT_MIN_LEVEL)
      ? level
      : DEFAULT_MIN_LEVEL
  const fallback = floor(parsed?.level)
  const categories = new Map(
    parsed?.categories.map(({ category, level }) => [category, floor(level)] as const),
  )
  return (category) => categories.get(category) ?? fallback
}
