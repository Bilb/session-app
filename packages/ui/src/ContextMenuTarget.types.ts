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
  /**
   * Where it sits in its parent, and how wide it may grow: taken from what it wraps, so a press
   * beside a message's bubble is not a press on the message.
   */
  alignSelf?: 'flex-start' | 'flex-end' | undefined
  maxWidth?: number | `${number}%` | undefined
  children: ReactNode
}
