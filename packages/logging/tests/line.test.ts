import { describe, expect, it } from 'vitest'

import { PREFIX_WIDTH, escapeMessage, formatPair, formatPrefix } from '#src/line'
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
        op: '#41c2e0',
      }),
    ).toBe('2026-10-08T03:20:09.123Z     +12.345 INFO  [network]        [#41c2e0]')
  })

  it('is the same width whatever the level, category, op or uptime', () => {
    const widths = new Set<number>()
    for (const level of LOG_LEVELS) {
      for (const category of ['ui', 'network', 'session-router']) {
        for (const op of [undefined, '#000000']) {
          for (const uptimeMs of [0, 412, 12_345, 4_211_870, 999_999_999]) {
            widths.add(formatPrefix({ wallMs: AT, uptimeMs, level, category, op }).length + 1)
          }
        }
      }
    }
    expect([...widths]).toEqual([PREFIX_WIDTH])
  })

  it('keeps a long category whole rather than cutting it', () => {
    expect(
      formatPrefix({ wallMs: AT, uptimeMs: 0, level: 'info', category: 'a-very-long-category' }),
    ).toContain('[a-very-long-category]')
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
