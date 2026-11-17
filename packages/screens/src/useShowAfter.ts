import { useEffect, useState } from 'react'

/**
 * How long something must still be loading before saying so. A conversation opens in a few
 * milliseconds, and a "Loading" that appears for one frame reads as a glitch, not as progress.
 */
export const SHOW_LOADING_AFTER_MS = 400

/** Whether `active` has stayed true for `delayMs`: false again the moment it stops. */
export function useShowAfter(active: boolean, delayMs: number = SHOW_LOADING_AFTER_MS): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!active) {
      setShown(false)
      return
    }
    const timer = setTimeout(() => {
      setShown(true)
    }, delayMs)
    return () => {
      clearTimeout(timer)
    }
  }, [active, delayMs])
  return active && shown
}
