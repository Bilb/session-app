import { describe, expect, it } from 'vitest'

import { accountIdLines } from '#src/settings/accountIdLines'

/** A real one: 66 hex characters, the `05` prefix and a 32-byte key. */
const ID = `05${'ab'.repeat(32)}`

describe('accountIdLines', () => {
  it('breaks a real account ID where the desktop client does', () => {
    expect(accountIdLines(ID).map((line) => line.length)).toEqual([27, 27, 12])
  })

  it('loses nothing', () => {
    expect(accountIdLines(ID).join('')).toBe(ID)
  })

  it('draws no empty line for a short id', () => {
    expect(accountIdLines('abc')).toEqual(['abc'])
  })

  it('returns nothing for nothing', () => {
    expect(accountIdLines('')).toEqual([])
  })
})
