import { flag } from './flags'

/** Where the run has put it, once somebody has turned it over. Null until then. */
let toggled: boolean | null = null

/**
 * Turns debug mode over for the rest of the run and says where it now is.
 *
 * In memory only, as the desktop client keeps it: a relaunch returns to the flag. See `debugMode`
 * in the flag table.
 */
export function toggleDebugMode(): boolean {
  toggled = !(toggled ?? flag('debugMode'))
  return toggled
}

/** Test seam: forgets the run's toggling. */
export function resetDebugMode(): void {
  toggled = null
}
