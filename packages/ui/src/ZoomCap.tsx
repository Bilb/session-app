import type { ReactNode } from 'react'
import { XStack } from 'tamagui'

import { usePageZoom } from './pageZoom'

/**
 * Holds what it wraps to at most `maxScale` times its size however far the desktop is zoomed in:
 * the page's zoom, counter-zoomed past the cap. For controls that sit beside something more worth
 * the room -- the onboarding header's buttons, which at 300% left the logo beside them no space.
 */
export function ZoomCap({ maxScale, children }: { maxScale: number; children: ReactNode }) {
  const zoom = usePageZoom()
  const counter = Math.min(1, maxScale / zoom)
  // `zoom` is a web style react-native's types do not list; Chromium compounds it with the page's.
  const style = { zoom: counter } as unknown as object
  return (
    <XStack alignItems="center" style={style}>
      {children}
    </XStack>
  )
}
