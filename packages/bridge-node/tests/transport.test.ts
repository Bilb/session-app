import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Frame, Request } from '@session/client'
import { describe, expect, it } from 'vitest'

import { createNodeBridgeTransport } from '#src/index'

// Enough of the addon to drive the transport without building any C++. The throws mirror the real
// Call(): a non-object is rejected before any field is read. Written out at run time because
// require() needs a real file and a committed .cjs is dead weight to every tool that walks the
// repo.
const stub = `
class SessionBridge {
  constructor(options, onFrame) {
    this.onFrame = onFrame
  }
  call(request) {
    if (typeof request !== 'object' || request === null)
      throw new TypeError('call(request) takes a Request object')
    if (typeof request.id !== 'number') throw new TypeError('Request.id: expected a number')
    if (typeof request.command !== 'object' || request.command === null)
      throw new TypeError('Request.command: expected an object')
    this.onFrame({ type: 'response', response: { id: request.id, result: { type: 'empty' } } })
  }
  close() {}
}
module.exports = { SessionBridge }
`

const addonPath = join(mkdtempSync(join(tmpdir(), 'session-stub-')), 'addon.cjs')
writeFileSync(addonPath, stub)

function open(): { transport: ReturnType<typeof createNodeBridgeTransport>; frames: Frame[] } {
  const frames: Frame[] = []
  const transport = createNodeBridgeTransport({
    dbPath: 'unused',
    cacheDir: 'unused',
    deferAccount: true,
    addonPath,
  })
  transport.setSink((frame) => frames.push(frame))
  return { transport, frames }
}

describe('the node transport, on what the renderer put on the port', () => {
  it('answers a request the addon cannot read on the stream', () => {
    const { transport, frames } = open()

    transport.send({ id: 7 } as unknown as Request)

    expect(frames).toEqual([{ type: 'response', response: { id: 7, error: expect.any(String) } }])
  })

  it('drops a message with no request id rather than throwing at its caller', () => {
    // In the main process this runs on the MessagePort handler, where a throw is uncaught and
    // ends the app.
    const { transport, frames } = open()
    const unreadable: unknown[] = [undefined, null, 42, 'x', {}]

    for (const bad of unreadable) {
      expect(() => transport.send(bad as Request)).not.toThrow()
    }

    expect(frames).toEqual([])
  })
})
