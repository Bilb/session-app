import { useEffect, useState } from 'react'
import { YStack } from 'tamagui'

import type { RevealProps } from './Reveal.types'

export type { RevealProps }

/** The client's own timing. Movement belongs to the layout, not to the arriving item. */
const DURATION_MS = 680

/**
 * Arrives by fading and rising. The web half, which does it as a CSS transition.
 *
 * No animation driver is configured for tamagui, so the transition is declared directly and the
 * starting values are held for one frame -- the same arrangement the onboarding chrome uses for
 * its crossfade, and for the same reason. See Reveal.native.tsx for what the timings copy.
 */
export function Reveal({ children, instant = false }: RevealProps) {
  const [shown, setShown] = useState(instant)

  useEffect(() => {
    if (instant) return
    const frame = setTimeout(() => {
      setShown(true)
    }, 16)
    return () => {
      clearTimeout(frame)
    }
  }, [instant])

  return (
    <YStack
      opacity={shown ? 1 : 0}
      {...(instant ? {} : { style: { transition: `opacity ${String(DURATION_MS)}ms ease-in` } })}
    >
      {children}
    </YStack>
  )
}
