import type { ReactNode } from 'react'

/**
 * The props both Screen variants accept.
 *
 * A third file so neither variant can grow a prop the other lacks: each imports this, and a
 * screen typechecks against whichever the bundler resolves.
 */
export interface ScreenProps {
  children: ReactNode
  padded?: boolean
  /**
   * Keeps content clear of the status bar, the notch and the home indicator. On by default
   * because a screen is the outermost frame and every one of them wants it; a pane that is
   * not against the edge of the display - the detail beside a list - passes `edges` instead.
   */
  edges?: readonly ('top' | 'bottom' | 'left' | 'right')[]
  testID?: string
}
