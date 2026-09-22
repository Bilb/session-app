import { describe, expect, it } from 'vitest'

import { accountIdLines } from '#src/settings/accountIdLines'

/** A real one: 66 hex characters, the `05` prefix and a 32-byte key. */
const ID = `05${'ab'.repeat(32)}`

describe('accountIdLines', () => {
  it('breaks a real account ID into three equal lines', () => {
    const lines = accountIdLines(ID)
    expect(lines).toHaveLength(3)
    expect(lines.map((line) => line.length)).toEqual([22, 22, 22])
  })

  it('loses nothing', () => {
    expect(accountIdLines(ID).join('')).toBe(ID)
  })

  it('puts a remainder on the last line rather than anywhere else', () => {
    // Nothing should produce this, but a short line in the middle would break the block, so the
    // rule is worth holding rather than leaving to whichever way the division rounded.
    expect(accountIdLines('abcdefg')).toEqual(['abc', 'def', 'g'])
  })

  it('survives an id shorter than the line count', () => {
    expect(accountIdLines('ab')).toEqual(['a', 'b'])
  })

  it('returns nothing for nothing', () => {
    expect(accountIdLines('')).toEqual([])
  })
})
