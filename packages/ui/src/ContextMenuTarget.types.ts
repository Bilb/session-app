import type { ReactNode } from 'react'

import type { MenuAnchor } from './contextMenuPlacement'

/**
 * The props both ContextMenuTarget variants accept.
 *
 * A third file so neither variant can grow a prop the other lacks. See Screen.types.ts.
 */
export interface ContextMenuTargetProps {
  /** Asks for the menu, at the pointer or the finger, in window coordinates. */
  onOpen: (anchor: MenuAnchor) => void
  children: ReactNode
}
