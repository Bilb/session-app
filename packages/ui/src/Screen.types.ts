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
  /**
   * Lifts the whole frame clear of the keyboard. On by default, because on almost every screen the
   * frame *is* the column being typed into.
   *
   * Off where the frame holds something beside that column -- onboarding's artwork on a tablet,
   * which was visibly shrinking as the keyboard came up. Such a screen wraps the part that should
   * move in `KeyboardAvoiding` itself.
   */
  avoidsKeyboard?: boolean
  testID?: string
}
