import type { BridgeTransport, Frame, Request } from '@session/client'
import { describe, expect, it } from 'vitest'

import { refuseUnstagedExports } from '#src/exportGate'

function recording(): BridgeTransport & { sent: Request[] } {
  const sent: Request[] = []
  return {
    sent,
    send: (request) => {
      sent.push(request)
    },
    setSink: () => undefined,
    close: () => undefined,
  }
}

function exportTo(destination: string): Request {
  return {
    id: 3,
    command: {
      type: 'exportAttachment',
      messageId: 7,
      index: 0,
      destination,
      notifySender: true,
      replace: false,
    },
  }
}

describe('the transport in front of the bridge', () => {
  it('passes an export to a staged path through', () => {
    const inner = recording()
    const gated = refuseUnstagedExports(inner, (d) => d === '/staged/x.pdf')

    gated.send(exportTo('/staged/x.pdf'))

    expect(inner.sent).toHaveLength(1)
  })

  it('answers an export anywhere else with an error and never forwards it', () => {
    const inner = recording()
    const frames: Frame[] = []
    const gated = refuseUnstagedExports(inner, () => false)
    gated.setSink((frame) => frames.push(frame))

    gated.send(exportTo('/data/user/0/org.getsession.session2/files/session/mainnet/session.db'))

    expect(inner.sent).toHaveLength(0)
    expect(frames).toEqual([
      {
        type: 'response',
        response: { id: 3, error: 'exportAttachment.destination was not staged' },
      },
    ])
  })

  it('leaves every other command alone', () => {
    const inner = recording()
    const gated = refuseUnstagedExports(inner, () => false)

    gated.send({ id: 1, command: { type: 'getAccountInfo' } })

    expect(inner.sent).toHaveLength(1)
  })
})
