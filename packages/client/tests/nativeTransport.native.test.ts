/**
 * The JSI transport's half of "a request the shim never saw is still answered".
 *
 * The addon's version of this is packages/bridge-node/tests/addon.test.ts, run against the real
 * C++. There is no JSI outside an app, so the bridge is stood in for here and what is under test
 * is the transport's own handling rather than the converter that produces the throw.
 */

import { describe, expect, it, vi } from 'vitest'

import type { Frame, SessionBridgeOptions } from '@session/bridge-types'

const bridge = vi.hoisted(() => ({
  setSink: vi.fn(),
  init: vi.fn(),
  call: vi.fn(),
  close: vi.fn(),
}))

vi.mock('@session/bridge-rn', () => ({ createSessionBridge: () => bridge }))

const { createNativeBridgeTransport } = await import('#src/nativeTransport.native')

const options: SessionBridgeOptions = {
  dbPath: '/nowhere/session.db',
  cacheDir: '/nowhere/cache',
  deferAccount: true,
}

const unreadable = { id: 8, command: { type: 'setDisplayName', name: 5 } } as unknown as Parameters<
  ReturnType<typeof createNativeBridgeTransport>['send']
>[0]

describe('the JSI transport', () => {
  it('answers a request JSI could not read on the stream, not by throwing', () => {
    const transport = createNativeBridgeTransport(options)
    const frames: Frame[] = []
    transport.setSink((frame) => frames.push(frame))

    bridge.call.mockImplementationOnce(() => {
      throw new TypeError('SetDisplayNameCommand.name: expected a string')
    })

    expect(() => {
      transport.send(unreadable)
    }).not.toThrow()
    expect(frames).toEqual([
      {
        type: 'response',
        response: { id: 8, error: 'SetDisplayNameCommand.name: expected a string' },
      },
    ])
  })

  it('holds that answer until there is a sink, as it does any other frame', () => {
    const transport = createNativeBridgeTransport(options)

    bridge.call.mockImplementationOnce(() => {
      throw new TypeError('SetDisplayNameCommand.name: expected a string')
    })
    transport.send(unreadable)

    const frames: Frame[] = []
    transport.setSink((frame) => frames.push(frame))
    expect(frames).toHaveLength(1)
  })
})
