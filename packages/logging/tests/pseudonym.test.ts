import { describe, expect, it } from 'vitest'

import { Pseudonyms } from '#src/pseudonym'

import { SALT } from './helpers'

describe('Pseudonyms', () => {
  it('is stable for one salt and differs across salts', () => {
    const a = new Pseudonyms(SALT)
    const b = new Pseudonyms(new Uint8Array(16).fill(9))
    expect(a.of('node-key')).toMatch(/^~[0-9a-f]{6}$/)
    expect(new Pseudonyms(SALT).of('node-key')).toBe(a.of('node-key'))
    expect(b.of('node-key')).not.toBe(a.of('node-key'))
    expect(a.of('other-key')).not.toBe(a.of('node-key'))
  })

  it('refuses a salt too short to key anything', () => {
    expect(() => new Pseudonyms(new Uint8Array(4))).toThrow()
  })
})
