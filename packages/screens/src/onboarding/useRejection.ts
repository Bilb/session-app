import { useEffect, useState } from 'react'

/**
 * A field's memory of having been refused, which is two facts rather than one.
 *
 * The designs ask for a refusal that fades in stages: the border, the text and any icon turn red
 * on a failed submit, and typing returns the text and clears the message **but leaves the border
 * red** until the field is submitted again. So a single `error` flag cannot express it -- one flag
 * says the last submit failed, the other says nothing has been typed since.
 *
 * The message clearing on the first keystroke is a deliberate departure from the written rules: a
 * stale error under a field somebody is actively correcting is confusing.
 *
 * Shared because the name field and the recovery phrase both want it, and a rule in two places is
 * a rule that gets half-changed.
 */
export interface Rejection {
  /** The last submit failed. Sticky, so the border stays red while a correction is typed. */
  readonly sticky: boolean
  /** Nothing has been typed since, so the message and the red text still stand. */
  readonly showing: boolean
  /** Call when a submit is refused here rather than by the caller's prop. */
  reject: () => void
  /** Call on every keystroke. */
  typed: () => void
  /** Call when the field is accepted, so a later screen does not inherit a red border. */
  clear: () => void
}

/**
 * `refused` latches rather than being read straight through, because the prop describes an attempt
 * that is over: left as the source of truth the message could not clear on the next keystroke the
 * way every other error on these screens does.
 */
export function useRejection(refused = false): Rejection {
  const [sticky, setSticky] = useState(false)
  const [showing, setShowing] = useState(false)

  useEffect(() => {
    if (!refused) return
    setSticky(true)
    setShowing(true)
  }, [refused])

  return {
    sticky,
    showing,
    reject: () => {
      setSticky(true)
      setShowing(true)
    },
    typed: () => {
      setShowing(false)
    },
    clear: () => {
      setSticky(false)
      setShowing(false)
    },
  }
}
