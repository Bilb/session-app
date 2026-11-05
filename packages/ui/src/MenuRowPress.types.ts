import type { ReactNode } from 'react'

/**
 * The props both MenuRowPress variants accept.
 *
 * A third file so neither variant can grow a prop the other lacks. See Screen.types.ts.
 */
export interface MenuRowPressProps {
  /**
   * The row the arrow keys or the pointer are on: drawn highlighted, and on the web the menu's one
   * tab stop. On native only the catalog sets it, to draw a forced state.
   */
  active: boolean
  disabled: boolean
  /** Set for a row that opens a submenu, with whether that submenu is open. */
  expanded?: boolean | undefined
  onActivate: () => void
  /** A pointer came onto the row: it becomes the active one, as the arrow keys would make it. */
  onHover: () => void
  /** The element the menu focuses when the arrow keys land here. */
  nodeRef: (node: unknown) => void
  testID: string
  /** The row, told whether it is drawn highlighted: active, or held down on native. */
  children: (highlighted: boolean) => ReactNode
}
