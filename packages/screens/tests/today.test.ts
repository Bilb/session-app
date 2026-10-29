import { describe, expect, it } from 'vitest'

import { createTodayClock, localDay } from '#src/today'

/** A clock the test moves, with one timer it fires by hand and a focus it switches. */
function harness(startMs: number) {
  let nowMs = startMs
  let pending: { run: () => void; atMs: number } | undefined
  let focusHandler: ((focused: boolean) => void) | undefined
  const clock = createTodayClock({
    now: () => nowMs,
    focus: {
      onFocusChange: (handler) => {
        focusHandler = handler
        return () => {
          focusHandler = undefined
        }
      },
    },
    setTimer: (run, ms) => {
      pending = { run, atMs: nowMs + ms }
      return pending
    },
    clearTimer: (timer) => {
      if (pending === timer) pending = undefined
    },
  })
  return {
    clock,
    /** Moves the clock to `ms`, firing the timer if it falls due. */
    moveTo(ms: number) {
      nowMs = ms
      if (pending !== undefined && pending.atMs <= ms) pending.run()
    },
    /** Moves the clock without running any timer, as a suspended app does. */
    sleepUntil(ms: number) {
      nowMs = ms
    },
    focus: (focused: boolean) => focusHandler?.(focused),
    pending: () => pending,
    listening: () => focusHandler !== undefined,
  }
}

const evening = new Date(2026, 9, 26, 23, 30).getTime()
const nextMorning = new Date(2026, 9, 27, 0, 0, 2).getTime()

describe('today', () => {
  it('turns at local midnight, and says so', () => {
    const h = harness(evening)
    let changes = 0
    h.clock.subscribe(() => (changes += 1))
    expect(h.clock.current()).toBe(localDay(evening))
    h.moveTo(nextMorning)
    expect(changes).toBe(1)
    expect(h.clock.current()).toBe(localDay(nextMorning))
  })

  it('aims at the next midnight after each one', () => {
    const h = harness(evening)
    h.clock.subscribe(() => undefined)
    h.moveTo(nextMorning)
    expect(h.pending()?.atMs).toBeGreaterThan(new Date(2026, 9, 28, 0, 0).getTime())
  })

  it('notices a day that turned while the app was away when it comes back to the front', () => {
    const h = harness(evening)
    let changes = 0
    h.clock.subscribe(() => (changes += 1))
    h.focus(false)
    h.sleepUntil(new Date(2026, 9, 28, 9, 0).getTime())
    expect(changes).toBe(0)
    h.focus(true)
    expect(changes).toBe(1)
  })

  it('says nothing when the day has not changed', () => {
    const h = harness(evening)
    let changes = 0
    h.clock.subscribe(() => (changes += 1))
    h.focus(true)
    expect(changes).toBe(0)
  })

  it('runs only while something listens', () => {
    const h = harness(evening)
    const stop = h.clock.subscribe(() => undefined)
    expect(h.listening()).toBe(true)
    stop()
    expect(h.listening()).toBe(false)
    expect(h.pending()).toBeUndefined()
  })
})
