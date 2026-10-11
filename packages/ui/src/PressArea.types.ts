import type { ReactNode } from 'react'

import type { FocusRingShape } from './keyboardPress'

/**
 * The props both PressArea variants accept.
 *
 * A third file so neither variant can grow a prop the other lacks. See Screen.types.ts, which is
 * the same arrangement for the same reason.
 */
export interface PressAreaProps {
  onPress?: () => void
  disabled?: boolean
  /** How far outside the control a touch still counts. Native only; a pointer needs no slop. */
  hitSlop?: number
  /** Takes an equal share of the row it is in, so a dialog's actions can share their width. */
  fill?: boolean
  accessibilityLabel?: string
  /**
   * `switch` for a control that flips between two values, announced with `checked` as its state.
   * A button otherwise.
   */
  role?: 'button' | 'switch'
  checked?: boolean
  /**
   * How the keyboard's focus ring is drawn round the control. Web only: the shape is the child's,
   * which only the caller knows. A rounded rectangle just outside the control, on the page.
   */
  ring?: FocusRingShape | undefined
  testID?: string
  /**
   * The control, told whether it is currently pressed.
   *
   * A function rather than an element because only the native half knows: on the web the styling
   * is CSS and this is always false.
   */
  children: (pressed: boolean) => ReactNode
}
