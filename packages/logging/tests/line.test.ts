import { describe, expect, it } from 'vitest'

import { PREFIX_WIDTH, escapeMessage, formatPair, formatPrefix, prefixToken } from '#src/line'
import { LOG_LEVELS } from '#src/level'

const AT = Date.UTC(2026, 9, 8, 3, 20, 9, 123)

describe('formatPrefix', () => {
  it('writes the documented example', () => {
    expect(
      formatPrefix({
        wallMs: AT,
        uptimeMs: 12_345,
        level: 'info',
        category: 'network',
        op: 'CoS-0-I7C3',
      }),
    ).toBe('2026-10-08T03:20:09.123Z     +12.345 INFO  [network]          [CoS-0-I7C3]    ')
  })

  it('is the same width whatever the level, category, op or uptime', () => {
    const widths = new Set<number>()
    for (const level of LOG_LEVELS) {
      for (const category of ['ui', 'network', 'session-router', 'onion-request-router']) {
        for (const op of [undefined, '#000000', 'RSC-1-MUE2-0']) {
          for (const uptimeMs of [0, 412, 12_345, 4_211_870, 999_999_999]) {
            widths.add(formatPrefix({ wallMs: AT, uptimeMs, level, category, op }).length + 1)
          }
        }
      }
    }
    expect([...widths]).toEqual([PREFIX_WIDTH])
  })

  it('fits a category of sixteen characters whole', () => {
    const prefix = formatPrefix({
      wallMs: AT,
      uptimeMs: 0,
      level: 'info',
      category: 'sixteen-chars-ok',
    })
    expect(prefix).toContain(' [sixteen-chars-ok] ')
    expect(prefix.length + 1).toBe(PREFIX_WIDTH)
  })

  it('cuts a longer category to fifteen characters and an ellipsis, in the same width', () => {
    const prefix = formatPrefix({
      wallMs: AT,
      uptimeMs: 0,
      level: 'info',
      category: 'onion-request-router',
    })
    expect(prefix).toContain(' [onion-request-r\u2026] ')
    expect(prefix.length + 1).toBe(PREFIX_WIDTH)
  })
})

describe('escapeMessage', () => {
  it('keeps one record on one line', () => {
    expect(escapeMessage('a\nb\r\nc\\d')).toBe('a\\nb\\nc\\\\d')
  })
})

describe('formatPair', () => {
  it('quotes only what would run into the next pair', () => {
    expect(formatPair('ms', '812')).toBe('ms=812')
    expect(formatPair('reason', 'timed out')).toBe('reason="timed out"')
    expect(formatPair('empty', '')).toBe('empty=""')
  })
})

describe('prefixToken', () => {
  it('keeps what an identifier is made of', () => {
    expect(prefixToken('quic-transport')).toBe('quic-transport')
    expect(prefixToken('CoS-0-GZHC-1')).toBe('CoS-0-GZHC-1')
  })

  it('can neither break a line nor carry a key whole', () => {
    expect(prefixToken('ui]\nforged')).toBe('ui__forged')
    expect(prefixToken('ab'.repeat(32))).toHaveLength(32)
  })
})
