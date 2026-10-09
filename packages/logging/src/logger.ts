import { capForSweep } from './cap'
import { LOG_LEVELS, levelRank, type LogLevel } from './level'
import { escapeMessage, formatPair, formatPrefix } from './line'
import type { Pseudonyms } from './pseudonym'
import { emptyCounts, sweep, type SweepCounts } from './sweep'
import { fromWire, Redacted, toWire, type LogFields, type LogValue, type WireValue } from './values'

/**
 * Where finished lines go: the file writer, or something in front of it. `urgent` asks for them to
 * reach the disk now rather than at the next flush; `wallMs` is when they were logged, which is
 * what a sink merging two processes' lines orders them by.
 */
export interface LogSink {
  write(lines: readonly string[], urgent: boolean, wallMs: number): void
}

/**
 * A line logged in one process to be swept, rendered and written by another: the desktop
 * renderer's, which main writes. Plain data, so it crosses a process boundary as it is, and timed
 * where it was logged rather than where it lands.
 */
export interface LogRecord {
  wallMs: number
  uptimeMs: number
  level: LogLevel
  category: string
  message: string
  fields?: Readonly<Record<string, WireValue>> | undefined
  op?: string | undefined
  /** A marker, written whatever the level and at once; a section line, written unprefixed. */
  kind?: 'marker' | 'section' | undefined
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
  /**
   * Lines written as they are, without the prefix: the startup block, which is for people and
   * reads better without a timestamp on every row. Still swept, and each still one line.
   */
  section(lines: readonly string[]): void
  /** How many times the sweep has fired since this logger was made. */
  sweepCounts(): SweepCounts
  /** A line another process logged, written as of when it was logged there. */
  record(record: LogRecord): void
}

function renderValue(value: LogValue, pseudonyms: Pseudonyms, counts: SweepCounts): string {
  if (value instanceof Redacted) return value.render(pseudonyms)
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'string') return sweep(capForSweep(value), pseudonyms, counts)
  return String(value)
}

/** Marker and error lines are the ones most likely to be followed by the process dying. */
function isUrgent(level: LogLevel, kind: LogRecord['kind']): boolean {
  return kind !== undefined || levelRank(level) >= levelRank('error')
}

export function createLogger(options: LoggerOptions): Logger {
  const { sink, pseudonyms, uptimeMs } = options
  const now = options.now ?? ((): number => Date.now())
  const minLevel = options.minLevel ?? ((): LogLevel => 'info')
  const counts = emptyCounts()

  function render(
    record: Omit<LogRecord, 'fields' | 'kind'>,
    fields: LogFields | undefined,
  ): string {
    const prefix = formatPrefix(record)
    const pairs =
      fields === undefined
        ? []
        : Object.entries(fields).map(([key, value]) =>
            formatPair(key, renderValue(value, pseudonyms, counts)),
          )
    const body = [sweep(capForSweep(record.message), pseudonyms, counts), ...pairs].join(' ')
    return `${prefix} ${escapeMessage(body)}`
  }

  function emit(level: LogLevel, lines: readonly string[], urgent: boolean, wallMs: number): void {
    sink.write(lines, urgent, wallMs)
    if (options.echo !== undefined) for (const line of lines) options.echo(level, line)
  }

  /** Every line goes through here, with the time it was logged, wherever that was. */
  function write(record: Omit<LogRecord, 'fields'>, fields: LogFields | undefined): void {
    const { level, kind, wallMs } = record
    if (kind === undefined && levelRank(level) < levelRank(minLevel(record.category))) return
    const line =
      kind === 'section'
        ? escapeMessage(sweep(capForSweep(record.message), pseudonyms, counts))
        : render(record, fields)
    emit(level, [line], isUrgent(level, kind), wallMs)
  }

  function log(
    level: LogLevel,
    category: string,
    message: string,
    fields?: LogFields,
    op?: string,
  ): void {
    write({ wallMs: now(), uptimeMs: uptimeMs(), level, category, message, op }, fields)
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
      write(
        {
          wallMs: now(),
          uptimeMs: uptimeMs(),
          level: 'info',
          category,
          message: `${MARKER} ${name}`,
          kind: 'marker',
        },
        fields,
      )
    },
    section: (lines) => {
      const wallMs = now()
      emit(
        'info',
        lines.map((line) => escapeMessage(sweep(capForSweep(line), pseudonyms, counts))),
        true,
        wallMs,
      )
    },
    sweepCounts: () => ({ ...counts }),
    record: (record) => {
      const fields =
        record.fields === undefined
          ? undefined
          : Object.fromEntries(
              Object.entries(record.fields).map(([key, value]) => [key, fromWire(value)]),
            )
      write(record, fields)
    },
  }
}

export interface ForwardingLoggerOptions {
  /** Where each record goes, to be rendered and written by the process that owns the files. */
  send: (record: LogRecord, urgent: boolean) => void
  /** Milliseconds since the process that writes started, so both processes share one zero. */
  uptimeMs: () => number
  now?: () => number
}

/**
 * A logger that renders nothing: each line goes to another process as a record, and is swept,
 * rendered and written there. The desktop renderer's, so the thread that draws the app never runs
 * the sweep, and never holds the pseudonym key.
 *
 * Levels are filtered where the line is written, so every line is sent; at the renderer's volume
 * that costs less than keeping two copies of the policy in step.
 */
export function createForwardingLogger(options: ForwardingLoggerOptions): Logger {
  const { send, uptimeMs } = options
  const now = options.now ?? ((): number => Date.now())

  function forward(
    level: LogLevel,
    category: string,
    message: string,
    fields: LogFields | undefined,
    op: string | undefined,
    kind: LogRecord['kind'],
  ): void {
    const wire =
      fields === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(fields).flatMap(([key, value]) => {
              const plain = toWire(value)
              return plain === undefined ? [] : [[key, plain] as const]
            }),
          )
    const record: LogRecord = {
      wallMs: now(),
      uptimeMs: uptimeMs(),
      level,
      category,
      message,
      ...(wire === undefined ? {} : { fields: wire }),
      ...(op === undefined ? {} : { op }),
      ...(kind === undefined ? {} : { kind }),
    }
    send(record, isUrgent(level, kind))
  }

  const log = (
    level: LogLevel,
    category: string,
    message: string,
    fields?: LogFields,
    op?: string,
  ): void => {
    forward(level, category, message, fields, op, undefined)
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
      forward('info', category, `${MARKER} ${name}`, fields, undefined, 'marker')
    },
    section: (lines) => {
      for (const line of lines) forward('info', '', line, undefined, undefined, 'section')
    },
    /** Counted where the lines are swept, which is not here. */
    sweepCounts: () => emptyCounts(),
    record: (record) => {
      send(record, isUrgent(record.level, record.kind))
    },
  }
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * A record from another process, or null where it is not one.
 *
 * Its source is the desktop renderer, the less trusted process, so every field is checked rather
 * than assumed; a field value that is not one is dropped, and the rest of the line kept.
 */
export function parseRecord(value: unknown): LogRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<Record<string, unknown>>
  const { wallMs, uptimeMs, level, category, message, op, kind, fields } = raw
  if (!isFiniteNumber(wallMs) || !isFiniteNumber(uptimeMs)) return null
  if (!LOG_LEVELS.some((known) => known === level)) return null
  if (!isString(category) || !isString(message)) return null
  if (op !== undefined && !isString(op)) return null
  if (kind !== undefined && kind !== 'marker' && kind !== 'section') return null
  let wire: Record<string, WireValue> | undefined
  if (fields !== undefined) {
    if (typeof fields !== 'object' || fields === null) return null
    wire = {}
    for (const [key, field] of Object.entries(fields)) {
      if (fromWire(field) !== undefined) wire[key] = field as WireValue
    }
  }
  return {
    wallMs,
    uptimeMs,
    level: level as LogLevel,
    category: capForSweep(category, 64),
    message,
    ...(wire === undefined ? {} : { fields: wire }),
    ...(op === undefined ? {} : { op: capForSweep(op, 64) }),
    ...(kind === undefined ? {} : { kind }),
  }
}
