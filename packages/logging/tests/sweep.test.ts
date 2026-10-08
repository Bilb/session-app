import { describe, expect, it } from 'vitest'

import { emptyCounts, sweep } from '#src/sweep'

import { pseudonyms } from './helpers'

const ACCOUNT = `05${'ab12'.repeat(16)}`
const NODE_KEY = 'f'.repeat(8) + '0123456789abcdef'.repeat(3) + 'deadbeef'
const MESSAGE_HASH = 'Q2hhbmdlIHRoaXMgdG8gYSByZWFsIGhhc2ggb2YgNDM'
const UUID = '7d2e9a10-4c1b-4b2f-9a0e-3f1c2b4d5e6f'

describe('sweep', () => {
  const p = pseudonyms()

  it('shortens an Account ID to its user-visible form', () => {
    const counts = emptyCounts()
    expect(sweep(`polling ${ACCOUNT} ns=0`, p, counts)).toBe('polling 05ab12...ab12 ns=0')
    expect(counts.hex).toBe(1)
  })

  it('pseudonymises a bare key, a base64 hash and a UUID', () => {
    const counts = emptyCounts()
    const out = sweep(`node ${NODE_KEY} hash ${MESSAGE_HASH} dir /x/${UUID}/y`, p, counts)
    expect(out).toBe(`node ${p.of(NODE_KEY)} hash ${p.of(MESSAGE_HASH)} dir /x/${p.of(UUID)}/y`)
    expect(counts).toMatchObject({ hex: 1, base64: 1, uuid: 1 })
  })

  it('pseudonymises a Session Router address and keeps its suffix', () => {
    const counts = emptyCounts()
    const router = 'cjtfkqnwtnuo1hu97fzhxgu3x1xmkakboazkuzh8oiupkcoqx3yo'
    expect(sweep(`Client started @ ${router}.sesh`, p, counts)).toBe(
      `Client started @ ${p.of(router)}.sesh`,
    )
    expect(counts.base32).toBe(1)
  })

  it('writes addresses as their class, and leaves times of day alone', () => {
    const counts = emptyCounts()
    expect(
      sweep('connect 144.76.164.202:22021 via [::ffff:10.0.0.2]:443 at 03:20:09', p, counts),
    ).toBe('connect <v4 public:22021> via <v6-mapped private:443> at 03:20:09')
    expect(counts.ip).toBe(2)
  })

  it('renders URLs inside free text', () => {
    const counts = emptyCounts()
    expect(sweep('GET https://example.org/room/abc failed', p, counts)).toBe(
      `GET https://${p.of('example.org')}/room/${p.of('abc')} failed`,
    )
    expect(counts.url).toBe(1)
  })

  it('takes out a run of words the shape of a recovery phrase', () => {
    const counts = emptyCounts()
    const phrase =
      'abbey ablaze abort absorb abyss aces aching acidic acoustic across actress acumen adapt'
    expect(sweep(`restoring ${phrase} now`, p, counts)).toBe('<15 words>')
    expect(counts.words).toBe(1)
  })

  it('leaves ordinary sentences, versions and numbers alone', () => {
    const counts = emptyCounts()
    const text = 'path built hops=3 ms=812 version 1.0.0 took 1234567 bytes'
    expect(sweep(text, p, counts)).toBe(text)
    expect(counts).toEqual(emptyCounts())
  })
})
