import type { ReactNode } from 'react'

export interface DirectionRootProps {
  /** Whether what is below this reads right to left. */
  rtl: boolean
  children: ReactNode
}
