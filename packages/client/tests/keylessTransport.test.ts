import { describe, expect, it, vi } from 'vitest'

import { createSessionClient } from '#src/createSessionClient'
import { KEY_MISSING, keyMissing, keyUnavailable } from '#src/databaseKey'
import { createFakeTransport } from '#src/fake/fakeBridge'
import { friends } from '#src/fake/fixtures'
import { createKeylessTransport } from '#src/keylessTransport'
import type { BridgeTransport } from '#src/types'

function alice() {
  const client = friends(['Alice', 'Bob']).clients['Alice']
  if (!client) throw new Error('fixture did not produce Alice')
  return client
}

/** A bridge with no key behind it, through the client every screen uses. */
describe('a keyless transport', () => {
  it('refuses every request with the key failure and its code, never running the clear', async () => {
    const clear = vi.fn<() => Promise<BridgeTransport>>()
    const client = createSessionClient(createKeylessTransport(keyMissing(), clear))

    await expect(client.getAccountInfo()).rejects.toMatchObject({
      message: keyMissing().message,
      code: KEY_MISSING,
    })
    await expect(client.setAttachmentCacheLimit(1)).rejects.toThrow(/^the database key is/)
    expect(clear).not.toHaveBeenCalled()
  })

  it('runs the clear on a discard, then answers from the bridge it opened', async () => {
    const clear = vi.fn(() => Promise.resolve(createFakeTransport(alice())))
    const client = createSessionClient(createKeylessTransport(keyUnavailable('locked'), clear))

    await client.discardAccount()
    expect(clear).toHaveBeenCalledTimes(1)
    expect((await client.getAccountInfo()).displayName).toBe('Alice')
  })

  it('reports a clear that failed as the discard’s refusal, and stays refusing', async () => {
    const client = createSessionClient(
      createKeylessTransport(keyMissing(), () => Promise.reject(new Error('EACCES'))),
    )
    await expect(client.discardAccount()).rejects.toThrow(/^discardAccount: EACCES$/)
    await expect(client.getAccountInfo()).rejects.toMatchObject({ code: KEY_MISSING })
  })

  it('refuses a second discard while the first is still clearing', async () => {
    let finish: (transport: BridgeTransport) => void = () => undefined
    const clear = vi.fn(
      () =>
        new Promise<BridgeTransport>((resolve) => {
          finish = resolve
        }),
    )
    const client = createSessionClient(createKeylessTransport(keyMissing(), clear))
    const first = client.discardAccount()
    await expect(client.discardAccount()).rejects.toThrow(/a clear is already running/)
    finish(createFakeTransport(alice()))
    await first
    expect(clear).toHaveBeenCalledTimes(1)
  })
})
