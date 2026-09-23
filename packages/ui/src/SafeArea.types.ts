import type { ReactNode } from 'react'

/**
 * The props both SafeArea variants accept.
 *
 * A third file so neither variant can grow a prop the other lacks. See Screen.types.ts, which is
 * the same arrangement for the same reason.
 */
export interface SafeAreaProps {
  children: ReactNode
  /** Which edges to keep clear. All of them unless a caller only cares about some. */
  edges?: readonly ('top' | 'bottom' | 'left' | 'right')[]
}
