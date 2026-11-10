import type { ReactNode } from 'react'

export interface BarTitleProps {
  children: ReactNode
  /** Centred in the bar, as a conversation's name is; otherwise from the start edge. */
  centred?: boolean | undefined
  testID?: string | undefined
}
