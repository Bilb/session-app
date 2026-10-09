import { levelWord, type LogLevel } from './level'

/**
 * The fixed-width front of every line, 77 columns, so the eye can skip to column 78:
 *
 * ```
 * 2026-10-08T03:20:09.123Z     +12.345 INFO  [network]        [CoS-0-GZHC]     clock resync
 * ```
 *
 * Time in UTC with its `Z`, so no reader has to guess a zone; seconds since the process started,
 * which a wall-clock step cannot disturb; the level as a word; the category and the operation in
 * brackets, padded so the message always starts in the same place.
 */
export const PREFIX_WIDTH = 77

/** `+seconds.mmm`, right-aligned on the decimal point; grows rather than wraps past 11.5 days. */
const UPTIME_WIDTH = 11
/** `[session-router]`, the longest category anything declares, exactly fills it. */
const CATEGORY_WIDTH = 16
/**
 * `[CoS-0-GZHC]`: libsession's request ids reach twelve characters with a sub-request suffix
 * (`RSC-1-MUE2-0`), and fourteen with the brackets. Blank outside a request.
 */
const OP_WIDTH = 16

export interface LinePrefix {
  wallMs: number
  uptimeMs: number
  level: LogLevel
  category: string
  /** libsession's request id, `CoS-0-GZHC`, or undefined outside a request. */
  op?: string | undefined
}

/** The longest category or op written; anything past it is cut. */
const TOKEN_MAX = 32

/**
 * A category or op as the prefix may carry it: the characters an identifier is made of, and no
 * other. The prefix is not swept and not escaped, so this is what stops either from breaking a
 * line in two or carrying a key - whatever process it came from.
 */
export function prefixToken(value: string): string {
  return value.slice(0, TOKEN_MAX).replace(/[^\w.#-]/g, '_')
}

export function formatPrefix({ wallMs, uptimeMs, level, category, op }: LinePrefix): string {
  const time = new Date(wallMs).toISOString()
  const uptime = `+${(uptimeMs / 1000).toFixed(3)}`.padStart(UPTIME_WIDTH)
  const bracketed = `[${prefixToken(category)}]`.padEnd(CATEGORY_WIDTH)
  const operation = (op === undefined ? '' : `[${prefixToken(op)}]`).padEnd(OP_WIDTH)
  return `${time} ${uptime} ${levelWord(level)} ${bracketed} ${operation}`
}

/** One record is one line: what would break it is escaped, so a grep never sees half of one. */
export function escapeMessage(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/\r/g, '\\r')
}

/** `key=value`, quoted only when the value would otherwise run into the next pair. */
export function formatPair(key: string, value: string): string {
  return /[\s="]/.test(value) || value === ''
    ? `${key}=${JSON.stringify(value)}`
    : `${key}=${value}`
}
