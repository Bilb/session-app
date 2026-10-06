import { describe, expect, it } from 'vitest'

import { looksLikeAccountId } from '#src/pubkey'

describe('looksLikeAccountId', () => {
  it('takes every account ID prefix followed by hex, at any length', () => {
    for (const prefix of ['05', '03', '15', '25', '00']) {
      expect(looksLikeAccountId(`${prefix}ab`)).toBe(true)
      expect(looksLikeAccountId(`${prefix}${'cd'.repeat(32)}`)).toBe(true)
    }
    expect(looksLikeAccountId('05ABCDEF')).toBe(true)
  })

  it('refuses a name, an unknown prefix, and a prefix with nothing after it', () => {
    expect(looksLikeAccountId('Alice')).toBe(false)
    expect(looksLikeAccountId('07abcd')).toBe(false)
    expect(looksLikeAccountId('05')).toBe(false)
    expect(looksLikeAccountId('05 abcd')).toBe(false)
  })
})
