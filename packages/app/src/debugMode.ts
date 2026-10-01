import { useSyncExternalStore } from 'react'

import { flag } from './flags'

/** Where the run has put it, once somebody has changed it. Null until then. */
let current: boolean | null = null

function isOn(): boolean {
  return current ?? flag('debugMode')
}

/** Screens drawing something only in debug mode, told when it turns over. */
const listeners = new Set<() => void>()

function set(on: boolean | null): void {
  current = on
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether debug mode is on, redrawing the caller when it turns over. */
export function useDebugMode(): boolean {
  return useSyncExternalStore(subscribe, isOn, isOn)
}

/**
 * Turns debug mode over for the rest of the run and says where it now is.
 *
 * In memory only: a relaunch returns to the flag. See `debugMode` in the flag table.
 */
export function toggleDebugMode(): boolean {
  const on = !isOn()
  set(on)
  return on
}

/** Test seam: forgets the run's changes. */
export function resetDebugMode(): void {
  set(null)
}
