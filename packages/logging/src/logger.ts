import { levelRank, type LogLevel } from './level'
import { escapeMessage, formatPair, formatPrefix } from './line'
import type { Pseudonyms } from './pseudonym'
import { hmacSha256, toHex, utf8 } from './sha256'
import { emptyCounts, sweep, type SweepCounts } from './sweep'
import { Redacted, type LogFields, type LogValue } from './values'

/**
 * Where finished lines go: the file writer where the files are, or the desktop renderer's pipe to
 * the main process. `urgent` asks for them to reach the disk now rather than at the next flush.
 */
export interface LogSink {
  write(lines: readonly string[], urgent: boolean): void
}

export interface LoggerOptions {
  sink: LogSink
  pseudonyms: Pseudonyms
  /** Milliseconds since the process started. Injected: no clock is common to all three runtimes. */
  uptimeMs: () => number
  now?: () => number
  /** The quietest level written for a category. Defaults to `info` for every category. */
  minLevel?: (category: string) => LogLevel
  /** Every written line, as well - the console in a development build. */
  echo?: (level: LogLevel, line: string) => void
}

/**
 * The marker token, `>>>`, which nothing else writes, so `grep '>>>'` is the run's outline.
 *
 * A marker's value is that it always fires - never filtered by level, never held in a buffer - so
 * a log missing one says the moment never happened rather than that it went unrecorded.
 */
export const MARKER = '>>>'

export interface Logger {
  log(level: LogLevel, category: string, message: string, fields?: LogFields, op?: string): void
  trace(category: string, message: string, fields?: LogFields): void
  debug(category: string, message: string, fields?: LogFields): void
  info(category: string, message: string, fields?: LogFields): void
  warn(category: string, message: string, fields?: LogFields): void
  error(category: string, message: string, fields?: LogFields): void
  critical(category: string, message: string, fields?: LogFields): void
  /** An unmissable line - `launch`, `background`, `start ok` - written whatever the level. */
  marker(category: string, name: string, fields?: LogFields): void
  /** Lines written as they are, after the prefix: the startup block. Still swept. */
  block(category: string, lines: readonly string[]): void
  /** A fresh operation id, `#41c2e0`, for every line of one send, poll or download to carry. */
  newOp(): string
  /** How many times the sweep has fired since this logger was made. */
  sweepCounts(): SweepCounts
}

function renderValue(value: LogValue, pseudonyms: Pseudonyms, counts: SweepCounts): string {
  if (value instanceof Redacted) return value.render(pseudonyms)
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'string') return sweep(value, pseudonyms, counts)
  return String(value)
}

export function createLogger(options: LoggerOptions): Logger {
  const { sink, pseudonyms, uptimeMs } = options
  const now = options.now ?? ((): number => Date.now())
  const minLevel = options.minLevel ?? ((): LogLevel => 'info')
  const counts = emptyCounts()
  let ops = 0

  function render(
    level: LogLevel,
    category: string,
    message: string,
    fields: LogFields | undefined,
    op: string | undefined,
  ): string {
    const prefix = formatPrefix({ wallMs: now(), uptimeMs: uptimeMs(), level, category, op })
    const pairs =
      fields === undefined
        ? []
        : Object.entries(fields).map(([key, value]) =>
            formatPair(key, renderValue(value, pseudonyms, counts)),
          )
    const body = [sweep(message, pseudonyms, counts), ...pairs].join(' ')
    return `${prefix} ${escapeMessage(body)}`
  }

  function emit(level: LogLevel, lines: readonly string[], urgent: boolean): void {
    sink.write(lines, urgent)
    if (options.echo !== undefined) for (const line of lines) options.echo(level, line)
  }

  function log(
    level: LogLevel,
    category: string,
    message: string,
    fields?: LogFields,
    op?: string,
  ): void {
    if (levelRank(level) < levelRank(minLevel(category))) return
    // An error is the line most likely to be followed by the process dying.
    emit(
      level,
      [render(level, category, message, fields, op)],
      levelRank(level) >= levelRank('error'),
    )
  }

  return {
    log,
    trace: (category, message, fields) => {
      log('trace', category, message, fields)
    },
    debug: (category, message, fields) => {
      log('debug', category, message, fields)
    },
    info: (category, message, fields) => {
      log('info', category, message, fields)
    },
    warn: (category, message, fields) => {
      log('warn', category, message, fields)
    },
    error: (category, message, fields) => {
      log('error', category, message, fields)
    },
    critical: (category, message, fields) => {
      log('critical', category, message, fields)
    },
    marker: (category, name, fields) => {
      emit('info', [render('info', category, `${MARKER} ${name}`, fields, undefined)], true)
    },
    block: (category, lines) => {
      emit(
        'info',
        lines.map((line) => render('info', category, line, undefined, undefined)),
        true,
      )
    },
    newOp: () => {
      ops += 1
      return `#${toHex(hmacSha256(utf8(String(now())), utf8(`op:${String(ops)}`))).slice(0, 6)}`
    },
    sweepCounts: () => ({ ...counts }),
  }
}
