import { afterEach, describe, expect, it, vi } from 'vitest'

import { Pseudonyms } from '#src/pseudonym'
import * as sha256 from '#src/sha256'

import { SALT } from './helpers'

vi.mock('#src/sha256', async (load) => {
  const real = await load<typeof sha256>()
  return { ...real, hmacSha256: vi.fn(real.hmacSha256) }
})

afterEach(() => {
  vi.mocked(sha256.hmacSha256).mockClear()
})

describe('Pseudonyms', () => {
  it('is stable for one salt and differs across salts', () => {
    const a = new Pseudonyms(SALT)
    const b = new Pseudonyms(new Uint8Array(16).fill(9))
    expect(a.of('node-key')).toMatch(/^~[0-9a-f]{8}$/)
    expect(new Pseudonyms(SALT).of('node-key')).toBe(a.of('node-key'))
    expect(b.of('node-key')).not.toBe(a.of('node-key'))
    expect(a.of('other-key')).not.toBe(a.of('node-key'))
  })

  it('refuses a salt too short to key anything', () => {
    expect(() => new Pseudonyms(new Uint8Array(4))).toThrow()
  })

  it('keeps an id in use while 4,096 newer ones pass through, and forgets an idle one', () => {
    const p = new Pseudonyms(SALT)
    p.of('hot')
    p.of('idle')
    for (let i = 0; i < 4096; i += 1) {
      p.of(`id-${String(i)}`)
      if (i % 1000 === 0) p.of('hot')
    }
    const hashes = vi.mocked(sha256.hmacSha256)
    hashes.mockClear()
    p.of('hot')
    expect(hashes).not.toHaveBeenCalled()
    p.of('idle')
    expect(hashes).toHaveBeenCalledTimes(1)
  })
})
