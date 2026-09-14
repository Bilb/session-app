import type { Frame, Request } from '@session/bridge-types'
import { describe, expect, it } from 'vitest'

import { createSessionClient } from '#src/createSessionClient'
import type { BridgeTransport } from '#src/types'

/** A transport that refuses whatever it is sent, with libsession's own kind of message. */
function refusing(message: string): BridgeTransport {
  let sink: ((frame: Frame) => void) | undefined
  return {
    setSink(next) {
      sink = next
    },
    send(request: Request) {
      sink?.({ type: 'response', response: { id: request.id, error: message } })
    },
    close() {
      // Nothing to close: there is no bridge behind this.
    },
  }
}

describe('a command the bridge refuses', () => {
  it('names the command in the error', async () => {
    // libsession describes the argument it would not take and says nothing about what was being
    // asked, so a refusal that escaped as an unhandled rejection named neither the caller nor the
    // command -- and eight commands carry a conversation id. The message has to carry it.
    const client = createSessionClient(refusing('Invalid conversation id: not a hex session ID'))

    await expect(client.markRead('nonsense')).rejects.toThrow(
      /markRead: Invalid conversation id: not a hex session ID/,
    )
  })
})
