import { requirePorts } from '@session/app'

/**
 * Ends the process after a device whose account was loaded has been cleared.
 *
 * Clearing removes the files, but the account's messages and names have sat in JavaScript strings
 * that nothing can scrub; only the end of the process gives that memory back. A relaunch where the
 * platform has one, so the person lands on onboarding; otherwise the app closes. Only after a
 * clear that succeeded: one that failed has a reason to show.
 */
export function endAfterClear(): void {
  const { restart, close } = requirePorts().window
  ;(restart ?? close)?.()
}
