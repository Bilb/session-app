import { ELEMENT } from '@session/test-ids'
import { useEffect, useState } from 'react'
import { YStack } from 'tamagui'

import {
  LANDING_ALPHA,
  LANDING_FADE_MS,
  LANDING_GLOW_PX,
  LANDING_GLOW_SPREAD_PX,
  LANDING_RING_PX,
} from './landingMetrics'
import type { LandingHighlightProps } from './LandingHighlight.types'

type Phase = 'shown' | 'fading' | 'gone'

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * The web half: the ring is drawn at full strength for one frame, then a CSS transition takes it
 * out. Under reduced motion it is shown for the same time and removed with no fade.
 */
export function LandingHighlight({
  serial,
  still = false,
  outgoing,
  radiusPx,
}: LandingHighlightProps) {
  const [played, setPlayed] = useState<{ serial: number | undefined; phase: Phase }>({
    serial,
    phase: serial === undefined ? 'gone' : 'shown',
  })
  // A new jump restarts the highlight during render, so it is never drawn a frame late.
  const current: typeof played =
    played.serial === serial ? played : { serial, phase: serial === undefined ? 'gone' : 'shown' }
  if (current !== played) setPlayed(current)

  useEffect(() => {
    if (still || current.phase !== 'shown') return
    if (prefersReducedMotion()) {
      const timer = setTimeout(() => setPlayed({ serial, phase: 'gone' }), LANDING_FADE_MS)
      return () => clearTimeout(timer)
    }
    // Two frames: the first paints it at full strength, the second starts the fade from there.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setPlayed({ serial, phase: 'fading' }))
    })
    return () => cancelAnimationFrame(frame)
  }, [serial, still, current.phase])

  useEffect(() => {
    if (current.phase !== 'fading') return
    const timer = setTimeout(() => setPlayed({ serial, phase: 'gone' }), LANDING_FADE_MS)
    return () => clearTimeout(timer)
  }, [serial, current.phase])

  const phase = still ? 'shown' : current.phase
  if (phase === 'gone') return null
  return (
    <YStack
      position="absolute"
      top={-LANDING_RING_PX}
      bottom={-LANDING_RING_PX}
      left={-LANDING_RING_PX}
      right={-LANDING_RING_PX}
      pointerEvents="none"
      opacity={phase === 'shown' ? 1 : 0}
      style={
        phase === 'fading' ? { transition: `opacity ${String(LANDING_FADE_MS)}ms ease-out` } : {}
      }
      aria-hidden
      testID={ELEMENT.conversation.messageHighlight}
    >
      <YStack
        flex={1}
        borderRadius={radiusPx + LANDING_RING_PX}
        borderWidth={LANDING_RING_PX}
        borderColor={outgoing ? '$textPrimary' : '$primaryColor'}
        opacity={LANDING_ALPHA}
        style={{
          boxShadow: `0 0 ${String(LANDING_GLOW_PX)}px ${String(LANDING_GLOW_SPREAD_PX)}px var(--${outgoing ? 'textPrimary' : 'primaryColor'})`,
        }}
      />
    </YStack>
  )
}
