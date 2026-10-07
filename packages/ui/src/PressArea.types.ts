import type { ReactNode } from 'react'

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
   * A button that stays on until pressed again, announced as pressed while it is. A segment of a
   * choice drawn as buttons; not the transient press `children` is told about.
   */
  toggled?: boolean
  testID?: string
  /**
   * The control, told whether it is currently pressed.
   *
   * A function rather than an element because only the native half knows: on the web the styling
   * is CSS and this is always false.
   */
  children: (pressed: boolean) => ReactNode
}
