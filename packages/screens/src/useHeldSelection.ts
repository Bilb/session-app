import { useEffect, useState } from 'react'

/** How long a pressed row waits for its route before it lets the selection go. */
const SELECTION_HOLD_MS = 1000

/**
 * Whether a row that opens something draws as selected: open, or pressed and on its way to being
 * open.
 *
 * The route that marks a row open lands a render or more after the press ends, and in between the
 * row would fall back to its hover for a frame -- pressed, then hovered, then selected. So a press
 * holds the selection until the route catches up, or for `SELECTION_HOLD_MS` if it never does.
 */
export function useHeldSelection(open: boolean): { held: boolean; hold: () => void } {
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    if (open) setPressed(false)
  }, [open])
  useEffect(() => {
    if (!pressed) return
    const timer = setTimeout(() => {
      setPressed(false)
    }, SELECTION_HOLD_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [pressed])
  return {
    held: open || pressed,
    hold: () => {
      setPressed(true)
    },
  }
}
