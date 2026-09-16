import type { ReactNode } from 'react'

/**
 * What a layout is told about the step it is framing.
 *
 * One shape for both, so a screen asks for a chrome without knowing which it will get -- the
 * width decides that, and a screen that had to know would be a screen with a third layout rule
 * in it.
 */
export interface ChromeProps {
  children: ReactNode
  testID: string
  onBack?: () => void
  barTitle?: string
  banner?: ReactNode
  padContent?: boolean
  avoidsKeyboard?: boolean
}
