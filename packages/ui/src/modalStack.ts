/**
 * What is open over the page, and what a single request to go back should do.
 *
 * Two stacks, not one. A modal can open another modal, and a modal can walk through screens of
 * its own -- app settings is both at once: a list of rows, each leading to a child screen, and
 * some of those asking a question in a dialog over the top. So "go back" has two possible
 * meanings at any moment and the answer depends on both stacks, which is the whole reason this
 * is a module rather than two `useState` calls.
 *
 * Kept free of react and of react-native so it can be tested directly: the rules below were
 * arrived at by writing the cases down, and they are worth holding still.
 */

/** As much of a modal as the rules need to know about. */
export interface StackedModal {
  /** Stable for the modal's lifetime, so a close handler can name itself after the stack moved. */
  id: string
  /**
   * How many screens deep this modal is. One means its own first screen, which is the floor: a
   * modal with no screen is not open.
   */
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
 * What Escape, the scrim and the Android back button should do, given everything that is open.
 *
 * **One level at a time, and the inner stack first.** Somebody three screens into settings with a
 * confirmation over the top expects Escape to take back the confirmation, not the afternoon. The
 * alternative -- closing the whole modal from anywhere inside it -- is what makes a deep settings
 * tree feel unsafe to explore.
 *
 * A modal that refuses dismissal stops the chain rather than passing it to the modal underneath:
 * it refused because there is something to answer, and answering it by closing its parent is
 * worse than nothing happening.
 */
export function backAction(modals: readonly StackedModal[]): BackAction {
  const top = modals.at(-1)
  if (top === undefined) return { kind: 'none' }
  if (top.screens > 1) return { kind: 'screen' }
  return top.dismissible ? { kind: 'modal' } : { kind: 'none' }
}

/**
 * Removes a modal and everything opened from it.
 *
 * **Everything above it goes too**, which is the only coherent answer: those modals were opened
 * from this one, and leaving them over a parent that has gone would strand them -- their close
 * would return to nothing.
 *
 * An id that is not in the stack leaves it untouched rather than throwing. A close handler
 * outlives what it closes: a dialog that dismisses itself as its own animation ends, or a
 * `finally` running after the stack was already cleared, would otherwise turn a race into a
 * crash. Closing what is already closed is what the caller meant either way.
 */
export function dismissFrom<T extends { id: string }>(modals: readonly T[], id: string): T[] {
  const at = modals.findIndex((modal) => modal.id === id)
  return at === -1 ? [...modals] : modals.slice(0, at)
}
