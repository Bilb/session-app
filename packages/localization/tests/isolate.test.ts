import { describe, expect, it } from 'vitest'

import { isolate } from '#src/isolate'

describe('isolate', () => {
  it('brackets the text in a first strong isolate and its pop', () => {
    expect(isolate('180 kB')).toBe('\u2068180 kB\u2069')
  })

  it('leaves nothing as nothing', () => {
    expect(isolate('')).toBe('')
  })
})
