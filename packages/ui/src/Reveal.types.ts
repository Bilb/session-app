import type { ReactNode } from 'react'

/**
 * The props both Reveal variants accept.
 *
 * A third file so neither variant can grow a prop the other lacks. See Screen.types.ts.
 */
export interface RevealProps {
  children: ReactNode
  /**
   * Appear at once rather than arriving.
   *
   * For automated tests, which otherwise photograph whatever is still moving. See the
   * `disableAnimations` flag.
   */
  instant?: boolean
}
