import type { ClientClosed } from '@session/client'
import { describe, expect, it, vi } from 'vitest'

import {
  CLOSE_INTERRUPT_MS,
  CLOSE_WAIT_MS,
  closeClientInBackground,
  type BackgroundCloseDeps,
} from '#src/backgroundClose'

const CLOSED: ClientClosed = {
  closed: true,
  waitedMs: 120,
  closeMs: 40,
  outboundBusy: false,
  interrupted: false,
}

/** A promise and the means to settle it, for a close or reopen the test finishes by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function harness() {
  let listener: (state: string) => void = () => {}
  const log = vi.fn<BackgroundCloseDeps['log']>()
  const deps = {
    client: {
      closeClient: vi.fn<BackgroundCloseDeps['client']['closeClient']>(() =>
        Promise.resolve(CLOSED),
      ),
      reopenClient: vi.fn<BackgroundCloseDeps['client']['reopenClient']>(() => Promise.resolve()),
    },
    onAppStateChange: (l: (state: string) => void) => {
      listener = l
    },
    task: { begin: vi.fn(), end: vi.fn() },
    log,
    flushLog: vi.fn(() => Promise.resolve()),
  }
  closeClientInBackground(deps)
  return { deps, log, to: (state: string) => listener(state) }
}

/** Lets every queued continuation run. */
const drain = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('closing the database in the background', () => {
  it('closes under the background task, writes the log out, then ends the task', async () => {
    const { deps, log, to } = harness()
    to('background')
    expect(deps.task.begin).toHaveBeenCalledTimes(1)
    await drain()

    expect(deps.client.closeClient).toHaveBeenCalledWith(CLOSE_WAIT_MS, CLOSE_INTERRUPT_MS)
    expect(log).toHaveBeenCalledWith('info', expect.stringContaining('closed after waiting 120 ms'))
    expect(deps.flushLog).toHaveBeenCalledTimes(1)
    expect(deps.task.end).toHaveBeenCalledTimes(1)
    expect(deps.flushLog.mock.invocationCallOrder[0]).toBeLessThan(
      deps.task.end.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('logs what a close lost at error level', async () => {
    const { deps, log, to } = harness()
    deps.client.closeClient.mockResolvedValueOnce({
      ...CLOSED,
      outboundBusy: true,
      interrupted: true,
    })
    to('background')
    await drain()
    expect(log).toHaveBeenCalledWith('error', expect.stringContaining('show as interrupted'))
    expect(log).toHaveBeenCalledWith('error', expect.stringContaining('rolled back'))
  })

  it('reopens on return without waiting for a close that is still waiting', async () => {
    const { deps, to } = harness()
    const close = deferred<ClientClosed>()
    deps.client.closeClient.mockReturnValueOnce(close.promise)
    to('background')
    await drain()

    to('active')
    // Sent while the close is outstanding: it is what cancels the close.
    expect(deps.client.reopenClient).toHaveBeenCalledTimes(1)
    expect(deps.task.end).not.toHaveBeenCalled()

    close.resolve({ ...CLOSED, closed: false })
    await drain()
    expect(deps.task.end).toHaveBeenCalledTimes(1)
  })

  it('neither closes nor reopens for a return before the close began', async () => {
    const { deps, to } = harness()
    to('background')
    to('active')
    await drain()
    expect(deps.client.closeClient).not.toHaveBeenCalled()
    expect(deps.client.reopenClient).not.toHaveBeenCalled()
    expect(deps.task.end).toHaveBeenCalledTimes(1)
  })

  it('starts the next close only once the last close and the reopen have settled', async () => {
    const { deps, to } = harness()
    const first = deferred<ClientClosed>()
    const reopen = deferred<undefined>()
    deps.client.closeClient.mockReturnValueOnce(first.promise)
    deps.client.reopenClient.mockReturnValueOnce(reopen.promise)

    to('background')
    await drain()
    to('active')
    to('background')
    await drain()
    // Still one: the first close and the reopen are both outstanding.
    expect(deps.client.closeClient).toHaveBeenCalledTimes(1)

    first.resolve(CLOSED)
    await drain()
    expect(deps.client.closeClient).toHaveBeenCalledTimes(1)
    reopen.resolve(undefined)
    await drain()
    expect(deps.client.closeClient).toHaveBeenCalledTimes(2)

    // One grace across both: the first close finishing did not end the second's.
    expect(deps.task.begin).toHaveBeenCalledTimes(1)
    expect(deps.task.end).toHaveBeenCalledTimes(1)
  })

  it('ignores the states between and a repeated background', async () => {
    const { deps, to } = harness()
    to('inactive')
    to('background')
    to('background')
    await drain()
    expect(deps.client.closeClient).toHaveBeenCalledTimes(1)
    expect(deps.task.begin).toHaveBeenCalledTimes(1)
  })

  it('logs a close the bridge refused, and still ends the task', async () => {
    const { deps, log, to } = harness()
    deps.client.closeClient.mockRejectedValueOnce(new Error('closeClient: refused'))
    to('background')
    await drain()
    expect(log).toHaveBeenCalledWith('error', 'close failed: closeClient: refused')
    expect(deps.task.end).toHaveBeenCalledTimes(1)
  })
})
