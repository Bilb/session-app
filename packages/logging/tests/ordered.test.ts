import { describe, expect, it } from 'vitest'

import type { LogSink } from '#src/logger'
import { orderedSink } from '#src/ordered'

/** Timers run by hand, so a test says exactly when the hold ends. */
function manualTimers() {
  let pending: (() => void) | null = null
  return {
    setTimeout: (handler: () => void) => {
      pending = handler
      return 1
    },
    clearTimeout: () => {
      pending = null
    },
    fire: () => {
      const handler = pending
      pending = null
      handler?.()
    },
  }
}

function recording(): LogSink & { lines: string[]; urgent: boolean[] } {
  const lines: string[] = []
  const urgent: boolean[] = []
  return {
    lines,
    urgent,
    write: (written, isUrgent) => {
      lines.push(...written)
      urgent.push(isUrgent)
    },
  }
}

describe('orderedSink', () => {
  it('writes lines in the order they were logged, not the order they arrived', () => {
    const inner = recording()
    const timers = manualTimers()
    let now = 10_000
    const sink = orderedSink(inner, { holdMs: 1000, now: () => now, timers })

    sink.write(['main at 9.6s'], false, 9_600)
    // The renderer's batch arrives after main's line, though it was logged before it.
    sink.write(['renderer at 9.2s'], false, 9_200)
    sink.write(['renderer at 9.9s'], false, 9_900)
    expect(inner.lines).toEqual([])

    now = 10_700
    timers.fire()
    // Only what has been held for the full second is out; the 9.9s line waits its turn.
    expect(inner.lines).toEqual(['renderer at 9.2s', 'main at 9.6s'])

    now = 11_000
    timers.fire()
    expect(inner.lines).toEqual(['renderer at 9.2s', 'main at 9.6s', 'renderer at 9.9s'])
  })

  it('keeps arrival order between lines logged in the same millisecond', () => {
    const inner = recording()
    const sink = orderedSink(inner, { holdMs: 1000, now: () => 0, timers: manualTimers() })
    sink.write(['first'], false, 5)
    sink.write(['second'], false, 5)
    sink.write(['marker'], true, 6)
    expect(inner.lines).toEqual(['first', 'second', 'marker'])
  })

  it('lets everything out at once for an urgent line, as urgent', () => {
    const inner = recording()
    const sink = orderedSink(inner, { holdMs: 1000, now: () => 0, timers: manualTimers() })
    sink.write(['held'], false, 3)
    sink.write(['>>> quit'], true, 4)
    expect(inner.lines).toEqual(['held', '>>> quit'])
    expect(inner.urgent).toEqual([true])
  })
})

describe('orderedSink.drain', () => {
  it('releases everything held, in order, without waiting for the hold', () => {
    const inner = recording()
    const timers = manualTimers()
    const sink = orderedSink(inner, { holdMs: 1000, now: () => 0, timers })
    sink.write(['main at 9.6s'], false, 9_600)
    sink.write(['renderer at 9.2s'], false, 9_200)
    sink.drain()
    expect(inner.lines).toEqual(['renderer at 9.2s', 'main at 9.6s'])
    // Nothing is left for the timer to release twice.
    timers.fire()
    expect(inner.lines).toEqual(['renderer at 9.2s', 'main at 9.6s'])
  })

  it('writes nothing when nothing is held', () => {
    const inner = recording()
    orderedSink(inner, { holdMs: 1000, now: () => 0, timers: manualTimers() }).drain()
    expect(inner.urgent).toEqual([])
  })
})
