/** One toast as the queue holds it. */
export interface QueuedToast {
  /** Names the toast, so the same message raised twice replaces itself rather than stacking. */
  id: string
  text: string
  /** Increases with every show, so a replacement counts as new for its timer and its position. */
  serial: number
}

/** How many are on screen at once; showing another drops the oldest. */
export const TOAST_LIMIT = 5

/**
 * The queue after one more is shown: newest first, a toast with the same id replaced rather than
 * repeated, and the oldest dropped beyond the limit.
 *
 * Kept out of React so the rules can be tested as data.
 */
export function withToast(queue: readonly QueuedToast[], toast: QueuedToast): QueuedToast[] {
  return [toast, ...queue.filter((held) => held.id !== toast.id)].slice(0, TOAST_LIMIT)
}

/** The queue without one toast. Only the one it names: a replacement has a newer serial. */
export function withoutToast(queue: readonly QueuedToast[], serial: number): QueuedToast[] {
  return queue.filter((held) => held.serial !== serial)
}
