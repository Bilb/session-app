import { describe, expect, it } from 'vitest'

import { hmacSha256, sha256, toHex, utf8 } from '#src/sha256'

describe('sha256', () => {
  it('matches the standard vectors', () => {
    expect(toHex(sha256(utf8('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(toHex(sha256(utf8('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    // Two blocks: the padding crosses a block boundary.
    expect(toHex(sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it('matches RFC 4231 for HMAC', () => {
    const key = new Uint8Array(20).fill(0x0b)
    expect(toHex(hmacSha256(key, utf8('Hi There')))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    )
  })

  it('encodes UTF-8 beyond ASCII', () => {
    expect([...utf8('é…😀')]).toEqual([0xc3, 0xa9, 0xe2, 0x80, 0xa6, 0xf0, 0x9f, 0x98, 0x80])
  })
})
