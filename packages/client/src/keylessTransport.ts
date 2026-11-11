import type { Request, Response } from '@session/bridge-types'

import type { DatabaseKeyError } from './databaseKey'
import type { BridgeTransport } from './types'

/**
 * A transport for a bridge that could not be made because its database key could not be had.
 *
 * Every request is refused with why, carrying the key failure's code, so the store lands on the
 * startup-failure screen and the screen can say which failure it was. **Except a discard**, which
 * is what that screen's Clear Device sends once somebody has confirmed it: that runs `clear`,
 * which deletes the database the key belonged to, makes a new key and opens a bridge on it. From
 * then on every request goes to that bridge, so the store starts again in place, on onboarding.
 *
 * `clear` is the app's, because deleting files and keeping a key are each app's own: nothing here
 * can reach a file system. Nothing but a discard runs it, and a discard is only ever sent by a
 * Clear somebody confirmed -- or by onboarding's back, which a start that failed cannot reach.
 */
export function createKeylessTransport(
  failure: DatabaseKeyError,
  clear: () => Promise<BridgeTransport>,
): BridgeTransport {
  let sink: Parameters<BridgeTransport['setSink']>[0] | null = null
  let opened: BridgeTransport | null = null
  let clearing = false
  let closed = false

  function answer(response: Response): void {
    // On a later turn, as a real bridge answers: a caller registers its pending entry before the
    // reply can arrive.
    void Promise.resolve().then(() => {
      sink?.({ type: 'response', response })
    })
  }

  function discard(request: Request): void {
    // A second press while the first is still running would delete what the first just made.
    if (clearing) {
      answer({ id: request.id, error: 'a clear is already running' })
      return
    }
    clearing = true
    clear().then(
      (transport) => {
        clearing = false
        if (closed) {
          transport.close()
          return
        }
        opened = transport
        if (sink !== null) transport.setSink(sink)
        answer({ id: request.id, result: { type: 'empty' } })
      },
      (error: unknown) => {
        clearing = false
        answer({ id: request.id, error: error instanceof Error ? error.message : String(error) })
      },
    )
  }

  return {
    send(request) {
      if (opened !== null) opened.send(request)
      else if (request.command.type === 'discardAccount') discard(request)
      else answer({ id: request.id, error: failure.message, code: failure.code })
    },
    setSink(onFrame) {
      sink = onFrame
      opened?.setSink(onFrame)
    },
    close() {
      closed = true
      sink = null
      opened?.close()
      opened = null
    },
  }
}
