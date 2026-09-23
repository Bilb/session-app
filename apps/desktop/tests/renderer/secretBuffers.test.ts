import type { Request } from '@session/bridge-types'
import { describe, expect, it } from 'vitest'

import { secretBuffers } from '#src/renderer/secretBuffers'

/**
 * Which buffers are handed over rather than copied, which is a list with two ways to be wrong.
 *
 * Give up too little and the secret is structured-cloned into the other process, where this side
 * can never reach it again -- the whole reason the phrase travels as bytes. Give up too much and a
 * buffer the sender still meant to read is detached under it, leaving an empty view and no error.
 *
 * Asserted rather than eyeballed because neither failure says anything at the time: the first
 * looks exactly like success, and the second surfaces somewhere else entirely.
 */
describe('what a request hands over', () => {
  const phrase = new TextEncoder().encode('one two three')

  it('gives up the buffer carrying a phrase', () => {
    const request: Request = {
      id: 1,
      command: { type: 'restoreAccountFromWords', phrase },
    }
    expect(secretBuffers(request)).toEqual([phrase.buffer])
  })

  it('gives up the phrase a check carries too, which is the same secret', () => {
    const request: Request = { id: 2, command: { type: 'checkRecoveryPhrase', phrase } }
    expect(secretBuffers(request)).toEqual([phrase.buffer])
  })

  it('gives up nothing for a command carrying no secret', () => {
    const request: Request = { id: 3, command: { type: 'getAccountInfo' } }
    expect(secretBuffers(request)).toEqual([])
  })
})
