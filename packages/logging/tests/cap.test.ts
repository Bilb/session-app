import { describe, expect, it } from 'vitest'

import { capForSweep } from '#src/cap'
import { emptyCounts, sweep } from '#src/sweep'

import { pseudonyms } from './helpers'

const KEY = 'ab'.repeat(32)

describe('capForSweep', () => {
  it('leaves a message within the limit alone', () => {
    expect(capForSweep('path built', 20)).toBe('path built')
  })

  it('cuts at a space, and says how much went', () => {
    expect(capForSweep('one two three', 7)).toBe('one two [cut 6 chars]')
  })

  it('drops the whole token a cut lands in, so no part of a key is left to escape the sweep', () => {
    const text = `node ${KEY} failed`
    const capped = capForSweep(text, 20)
    expect(capped).toBe(`node [cut ${String(text.length - 'node'.length)} chars]`)
    // Without the drop, 15 hex digits of the key would be written: too short for the sweep.
    expect(sweep(capped, pseudonyms(), emptyCounts())).not.toMatch(/[0-9a-f]{8}/)
  })

  it('leaves only the note when the cut lands in a token that started the message', () => {
    expect(capForSweep(KEY, 10)).toBe(`[cut ${String(KEY.length)} chars]`)
  })
})
