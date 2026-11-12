import type { StoreApi } from 'zustand/vanilla'

/** What a hook needs of a store: the part `useStore` reads. */
export type ReadableStore<T> = Pick<StoreApi<T>, 'getState' | 'getInitialState' | 'subscribe'>

// This package compiles with no platform library; every runtime it runs on has these.
declare const setTimeout: (run: () => void, ms: number) => unknown
declare const clearTimeout: (timer: unknown) => void

/**
 * The same store, telling its subscribers of a burst of changes once.
 *
 * Every frame from the bridge is its own task, so a poll or a config merge that changes N rows
 * is N store updates and, told of each, N renders. The store itself stays current after every
 * event, which is what its ordering relies on: only the telling is held back.
 *
 * The first change of a burst is told at once. Changes after it are held for a timer of no
 * delay, so a burst is drawn about as often as it can be drawn. How long that timer takes is the
 * platform's: Chromium runs it after the frames already queued, React Native on its next frame.
 */
export function coalesced<T>(store: StoreApi<T>, holdMs = 0): ReadableStore<T> {
  const listeners = new Set<(state: T, previous: T) => void>()
  let told = store.getState()
  let timer: unknown
  let unsubscribe: (() => void) | undefined

  function tell(): boolean {
    const state = store.getState()
    if (state === told) return false
    const previous = told
    told = state
    // A copy: a listener may unsubscribe, or subscribe another, while being told.
    for (const listener of [...listeners]) listener(state, previous)
    return true
  }

  // The timer is set before the telling in both: a listener that changes the store comes back
  // into `onChange`, which must find the hold already on rather than start a second one.
  function closeWindow(): void {
    timer = setTimeout(closeWindow, holdMs)
    if (tell()) return
    clearTimeout(timer)
    timer = undefined
  }

  function onChange(): void {
    if (timer !== undefined) return
    timer = setTimeout(closeWindow, holdMs)
    tell()
  }

  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe(listener) {
      if (listeners.size === 0) {
        told = store.getState()
        unsubscribe = store.subscribe(onChange)
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        unsubscribe?.()
        unsubscribe = undefined
        clearTimeout(timer)
        timer = undefined
      }
    },
  }
}
