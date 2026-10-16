import type { LogRecord } from '@session/logging'
import { describe, expect, it } from 'vitest'

import { recordQueue } from '#src/renderer/recordQueue'

function record(message: string): LogRecord {
  return { wallMs: 0, uptimeMs: 0, level: 'info', category: 'ui', message }
}

/** Resolves in a later task than the one that called it. */
const nextTask = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })

describe('recordQueue', () => {
  it('sends a burst logged in one task as one message, before the next task', async () => {
    const sent: string[][] = []
    const queue = recordQueue((records) => sent.push(records.map((r) => r.message)))
    queue.send(record('a'), false)
    queue.send(record('b'), false)
    expect(sent).toEqual([])
    await nextTask()
    expect(sent).toEqual([['a', 'b']])
  })

  it('sends an urgent record at once, with whatever was logged before it', () => {
    const sent: string[][] = []
    const queue = recordQueue((records) => sent.push(records.map((r) => r.message)))
    queue.send(record('held'), false)
    queue.send(record('>>> marker'), true)
    expect(sent).toEqual([['held', '>>> marker']])
  })

  it('hands over what is waiting when flushed, ahead of a message that ends the process', async () => {
    const sent: string[] = []
    const queue = recordQueue((records) => sent.push(...records.map((r) => r.message)))
    queue.send(record('before restart'), false)
    queue.flush()
    sent.push('restart')
    await nextTask()
    expect(sent).toEqual(['before restart', 'restart'])
  })
})
