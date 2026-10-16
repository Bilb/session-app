import { describe, expect, it } from 'vitest'

import { Redacted, fromWire, internalId } from '#src/values'

import { pseudonyms } from './helpers'

describe('fromWire', () => {
  it('takes an id or host up to 256 characters and refuses a longer one', () => {
    for (const [field, wire] of [
      ['raw', { redacted: 'visible' }],
      ['raw', { redacted: 'internal' }],
      ['host', { redacted: 'address' }],
    ] as const) {
      expect(fromWire({ ...wire, [field]: 'a'.repeat(256) })).toBeInstanceOf(Redacted)
      expect(fromWire({ ...wire, [field]: 'a'.repeat(257) })).toBeUndefined()
    }
  })

  it('takes a URL up to 2,048 characters and refuses a longer one', () => {
    const at = (chars: number) => `https://example.org/${'a'.repeat(chars - 20)}`
    expect(fromWire({ redacted: 'url', raw: at(2048) })).toBeInstanceOf(Redacted)
    expect(fromWire({ redacted: 'url', raw: at(2049) })).toBeUndefined()
  })

  it('takes a kind that is a short lowercase word and refuses anything else', () => {
    const internal = (kind: unknown) => fromWire({ redacted: 'internal', raw: 'node', kind })
    expect(internal('snode')).toBeInstanceOf(Redacted)
    expect(internal('file-server')).toBeInstanceOf(Redacted)
    expect(internal('Snode')).toBeUndefined()
    expect(internal('a'.repeat(17))).toBeUndefined()
    expect(internal(`05${'ab'.repeat(32)}`)).toBeUndefined()
    expect(internal('snode ')).toBeUndefined()
    expect(internal(3)).toBeUndefined()
  })
})

describe('internalId', () => {
  it('leaves off a kind that is not a short lowercase word, rather than writing it unswept', () => {
    const p = pseudonyms()
    expect(internalId('node', 'snode').render(p)).toBe(`snode${p.of('node')}`)
    expect(internalId('node', `05${'ab'.repeat(32)}`).render(p)).toBe(p.of('node'))
    expect(internalId('node', 'a b').render(p)).toBe(p.of('node'))
  })
})
