import type { ReactNode } from 'react'

export interface SlidePagerProps {
  /** Which page is showing. Changing it slides. */
  index: number
  /** Cut rather than slide. See the `disableAnimations` flag. */
  instant?: boolean
  /** One per page, in order. */
  children: ReactNode[]
}
