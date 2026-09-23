import { useEffect, useRef, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller'

import { advance, windowSizeChanged, type Replacement } from './keyboardHold'
import type { KeyboardAvoidingProps } from './KeyboardAvoiding.types'

export type { KeyboardAvoidingProps }

const FILL = { flex: 1 } as const

/**
 * The longest a hold can last, for the case where no keyboard comes back.
 *
 * **A ceiling, not the duration.** Measured on an iPad, a rotation takes about 570ms from the
 * window changing size to the replacement keyboard being reported -- so a fixed interval anywhere
 * near that ends mid-gap and draws the drop it exists to prevent. A hold ends on the replacement
 * arriving; this only covers one that never does.
 */
const HOLD_CEILING_MS = 2000

/** A window size as a comparable value. */
function windowSize(width: number, height: number): string {
  return `${String(width)}x${String(height)}`
}

/**
 * Holds its children clear of the keyboard, and only its children.
 *
 * `Screen` already does this for the whole frame, which is right almost everywhere: a screen is a
 * column of content and a field near the bottom of it, and lifting the column is what should
 * happen. Onboarding on a tablet is the exception -- the frame is artwork beside a column, and
 * lifting the frame lifted the artwork too, which visibly shrank a picture that has nothing to do
 * with the field being typed into. So the frame opts out and the column wraps itself in this.
 *
 * Same implementation as `Screen`'s, and the same reason for it: the platform's own avoiding view
 * replays a guess at the keyboard's animation, where this follows the keyboard's own.
 *
 * **Except across a keyboard being replaced**, when it holds still instead -- see `advance`. The
 * avoiding view is switched off for that moment and a fixed inset put in its place, so there is
 * no second animation anywhere: a hold is the absence of movement, not a guess at one.
 *
 * Control goes back the moment the replacement is reported, which is when the avoiding view's own
 * value is correct again.
 *
 * **The step at that handover is not animated, and must not be animated this way.** The inset has
 * to sit on the avoiding view itself: that view is not an animated one, so animating the inset
 * means moving it to a child -- and a child's padding *adds* to the view's own rather than
 * replacing it. Measured, the inset then applies twice, the centred column lands in a box barely
 * wider than its own height and clips off the top, and the correction at the end is far larger
 * than the step it would smooth.
 */
export function KeyboardAvoiding({ children }: KeyboardAvoidingProps) {
  const { width, height } = useWindowDimensions()
  /**
   * The keyboard as the avoiding view sees it.
   *
   * The library's own state rather than react-native's `Keyboard` events: the two are separate
   * subscriptions with no ordering between them, and a hold released on one while handing back to
   * the other draws the flicker it exists to remove.
   */
  const keyboard = useKeyboardState()

  /** The inset while a replacement is in flight. Null when the avoiding view is in charge. */
  const [held, setHeld] = useState<number | null>(null)
  const stage = useRef<Replacement>('before')

  const previous = useRef<string | null>(null)
  const next = windowSize(width, height)

  /**
   * Where the content was, read through a ref rather than as state: by the time the window
   * changes the keyboard may already be going, and a hold wants the height it had before that.
   */
  const lastHeight = useRef(0)
  if (keyboard.height > 0) lastHeight.current = keyboard.height

  useEffect(() => {
    if (!windowSizeChanged(previous.current, next)) {
      previous.current = next
      return
    }
    previous.current = next
    if (lastHeight.current === 0) return

    stage.current = 'before'
    setHeld(lastHeight.current)

    // Only for a keyboard that never comes back. See `HOLD_CEILING_MS`.
    const ceiling = setTimeout(() => {
      setHeld(null)
    }, HOLD_CEILING_MS)
    return () => {
      clearTimeout(ceiling)
    }
  }, [next])

  useEffect(() => {
    if (held === null) return
    stage.current = advance(stage.current, keyboard.height, held)
    if (stage.current === 'done') setHeld(null)
  }, [held, keyboard.height])

  return (
    <KeyboardAvoidingView
      style={held === null ? FILL : { ...FILL, paddingBottom: held }}
      behavior="padding"
      enabled={held === null}
    >
      {children}
    </KeyboardAvoidingView>
  )
}
