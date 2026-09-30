/**
 * The rules for what a back request closes, across two stacks: modals over modals, and each
 * modal's own screens. Kept free of react and react-native so they can be tested directly.
 */

/** As much of a modal as the rules need to know about. */
export interface StackedModal {
  /** Stable for the modal's lifetime, so a close handler can name itself after the stack moved. */
  id: string
  /** How many screens deep this modal is; at least 1, its own first screen. */
  screens: number
  /** Whether a press outside, Escape, or the hardware back button may close it. */
  dismissible: boolean
}

/** What a single back request resolves to. */
export type BackAction =
  /** Pop the topmost modal's own screen stack; the modal stays open. */
  | { kind: 'screen' }
  /** Close the topmost modal. */
  | { kind: 'modal' }
  /** Nothing to do: nothing is open, or the top modal refuses to be dismissed. */
  | { kind: 'none' }

/**
 * What Escape, the scrim and the Android back button do: one level at a time, the top modal's own
 * screens first. A modal that refuses dismissal stops the chain rather than passing it to the
 * modal underneath -- closing its parent would leave its question unanswered.
 */
export function backAction(modals: readonly StackedModal[]): BackAction {
  const top = modals.at(-1)
  if (top === undefined) return { kind: 'none' }
  if (top.screens > 1) return { kind: 'screen' }
  return top.dismissible ? { kind: 'modal' } : { kind: 'none' }
}

/**
 * Removes a modal and everything opened from it, always returning a new array.
 *
 * An unknown id is a no-op rather than an error: a close handler can outlive what it closes, e.g.
 * a `finally` running after the stack was already cleared.
 */
export function dismissFrom<T extends { id: string }>(modals: readonly T[], id: string): T[] {
  const at = modals.findIndex((modal) => modal.id === id)
  return at === -1 ? [...modals] : modals.slice(0, at)
}
