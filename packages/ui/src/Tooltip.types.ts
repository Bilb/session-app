import type { ReactNode } from 'react'

import type { TooltipPlacement } from './tooltipPosition'

/**
 * The props both Tooltip variants accept.
 *
 * A third file so neither variant can grow a prop the other lacks. See Screen.types.ts.
 */
export interface TooltipProps {
  /**
   * What the tooltip says. The control it wraps carries the same words as its accessibility
   * label, which is what a screen reader announces: the bubble is hidden from assistive
   * technology so the name is not read twice, and on touch, where there is no bubble, the label
   * is all there is.
   */
  label: string
  /** Defaults to `end`: a rail at the window's start edge opens its tooltips into the window. */
  placement?: TooltipPlacement | undefined
  /**
   * Shows the bubble whatever the pointer does, for the component gallery and screenshot tests,
   * which have no pointer to rest.
   */
  held?: boolean | undefined
  /** The control. A tooltip describes one control, never a group of them. */
  children: ReactNode
  /** On the bubble, so a test can tell it is showing. */
  testID?: string | undefined
}
