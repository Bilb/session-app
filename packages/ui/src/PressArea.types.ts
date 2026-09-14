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
  accessibilityLabel?: string
  testID?: string
  /**
   * The control, told whether it is currently pressed.
   *
   * A function rather than an element because only the native half knows: on the web the styling
   * is CSS and this is always false.
   */
  children: (pressed: boolean) => ReactNode
}
