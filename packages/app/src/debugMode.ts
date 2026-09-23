import { flag } from './flags'

/** Where the run has put it, once somebody has changed it. Null until then. */
let current: boolean | null = null

function isOn(): boolean {
  return current ?? flag('debugMode')
}

function set(on: boolean): boolean {
  current = on
  return on
}

/**
 * Turns debug mode over for the rest of the run and says where it now is: the desktop client's
 * ten presses, which toggle it both ways.
 *
 * In memory only: a relaunch returns to the flag. See `debugMode` in the flag table.
 */
export function toggleDebugMode(): boolean {
  return set(!isOn())
}

/**
 * Turns debug mode on for the rest of the run: the iOS client's taps, which only ever enable it.
 * Returns whether this changed anything.
 */
export function enableDebugMode(): boolean {
  if (isOn()) return false
  set(true)
  return true
}

/** Test seam: forgets the run's changes. */
export function resetDebugMode(): void {
  current = null
}
