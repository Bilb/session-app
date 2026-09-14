import { useEffect, useState } from 'react'
import { YStack } from 'tamagui'

import type { RevealProps } from './Reveal.types'

export type { RevealProps }

/** The client's own timing: the fade runs 680ms, and the movement keeps it company. */
const DURATION_MS = 680
const RISE_FROM = 12

/**
 * Arrives by fading and rising. The web half, which does it as a CSS transition.
 *
 * No animation driver is configured for tamagui, so the transition is declared directly and the
 * starting values are held for one frame -- the same arrangement the onboarding chrome uses for
 * its crossfade, and for the same reason. See Reveal.native.tsx for what the timings copy.
 */
export function Reveal({ children }: RevealProps) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const frame = setTimeout(() => {
      setShown(true)
    }, 16)
    return () => {
      clearTimeout(frame)
    }
  }, [])

  return (
    <YStack
      opacity={shown ? 1 : 0}
      y={shown ? 0 : RISE_FROM}
      style={{
        transition: `opacity ${String(DURATION_MS)}ms ease-in, transform ${String(DURATION_MS)}ms ease-out`,
      }}
    >
      {children}
    </YStack>
  )
}
