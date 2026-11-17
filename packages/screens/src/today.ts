import { requirePorts, type WindowPort } from '@session/app'
import { localDayNumber } from '@session/localization'
import { useSyncExternalStore } from 'react'

/**
 * Past local midnight before the day is looked at again: a timer can fire a little early, and one
 * that lands before midnight would find the same day and wait another whole day to try again.
 */
const PAST_MIDNIGHT_MS = 1000

/** A local calendar day as a whole number, as the time formatting counts days. */
export const localDay = (ms: number): number => localDayNumber(new Date(ms))

function nextMidnightMs(ms: number): number {
  const date = new Date(ms)
  date.setHours(24, 0, 0, 0)
  return date.getTime()
}

export interface TodayClockOptions {
  now: () => number
  /** Coming back to the front is when a day that turned while away is noticed. */
  focus: Pick<WindowPort, 'onFocusChange'>
  setTimer: (run: () => void, ms: number) => unknown
  clearTimer: (timer: unknown) => void
}

export interface TodayClock {
  subscribe: (onChange: () => void) => () => void
  /** Today, as `localDay` counts it. */
  current: () => number
}

/**
 * Today, and word when it changes: at local midnight, and on coming back to the front, since a
 * timer does not run while the app is suspended. What says "today" or a weekday reads it, so a
 * screen left open past midnight words its times for the new day.
 *
 * Runs only while something is listening. Plain rather than a hook so a test can drive it with a
 * clock of its own.
 */
export function createTodayClock(options: TodayClockOptions): TodayClock {
  const listeners = new Set<() => void>()
  let day = localDay(options.now())
  let timer: unknown
  let stopFocus: (() => void) | undefined

  function check(): void {
    const now = localDay(options.now())
    if (now === day) return
    day = now
    for (const listener of [...listeners]) listener()
  }

  function schedule(): void {
    if (timer !== undefined) options.clearTimer(timer)
    const nowMs = options.now()
    timer = options.setTimer(
      () => {
        timer = undefined
        check()
        schedule()
      },
      nextMidnightMs(nowMs) - nowMs + PAST_MIDNIGHT_MS,
    )
  }

  function start(): void {
    day = localDay(options.now())
    schedule()
    stopFocus = options.focus.onFocusChange((focused) => {
      if (!focused) return
      check()
      // Timers drift while suspended: aim again at the midnight to come.
      schedule()
    })
  }

  function stop(): void {
    if (timer !== undefined) options.clearTimer(timer)
    timer = undefined
    stopFocus?.()
    stopFocus = undefined
  }

  return {
    subscribe(onChange) {
      if (listeners.size === 0) start()
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
        if (listeners.size === 0) stop()
      }
    },
    current: () => day,
  }
}

let shared: TodayClock | undefined

function clock(): TodayClock {
  shared ??= createTodayClock({
    now: () => Date.now(),
    focus: requirePorts().window,
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (timer) => {
      clearTimeout(timer as ReturnType<typeof setTimeout>)
    },
  })
  return shared
}

// Module-level so that their identity is stable: React resubscribes whenever `subscribe` changes.
const subscribeToday = (onChange: () => void): (() => void) => clock().subscribe(onChange)
const currentDay = (): number => clock().current()

/** Today, as `localDay` counts it; a component reading it is drawn again when the day turns. */
export function useToday(): number {
  return useSyncExternalStore(subscribeToday, currentDay)
}
