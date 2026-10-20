import type { ReactNode } from 'react'

/** Nothing to cap on a phone or tablet: nothing zooms the page there. See the desktop version. */
export function ZoomCap({ children }: { maxScale: number; children: ReactNode }) {
  return children
}
