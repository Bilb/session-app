import { useEffect, useRef, useState } from 'react'
import { YStack } from 'tamagui'

import { RING_TURN_MS, type RingSpinProps } from './RingSpin.types'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** The system's reduced-motion setting, followed while mounted. False where nothing can say. */
function usePrefersReducedMotion(): boolean {
  const [query] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION) : null,
  )
  const [reduced, setReduced] = useState(query?.matches ?? false)
  useEffect(() => {
    if (query === null) return
    const follow = (event: MediaQueryListEvent) => {
      setReduced(event.matches)
    }
    query.addEventListener('change', follow)
    return () => {
      query.removeEventListener('change', follow)
    }
  }, [query])
  return reduced
}

/**
 * A layer turning about its centre, the web half: a Web Animation on the layer's element, so the
 * compositor turns it without a render per frame, and a screenshot that disables animations
 * cancels it back to its starting angle.
 */
export function RingSpin({ size, still, children }: RingSpinProps) {
  const layer = useRef<HTMLElement | null>(null)
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    const element = layer.current
    // jsdom has no `animate`; a test draws the starting angle, which is what a still ring is.
    if (still || reduced || element === null || typeof element.animate !== 'function') return
    const turning = element.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: RING_TURN_MS, iterations: Infinity, easing: 'linear' },
    )
    // Cancelling rejects `finished`, which nothing waits on; a DOM that does not mark that
    // promise handled would report the rejection.
    turning.finished.catch(() => undefined)
    return () => {
      turning.cancel()
    }
  }, [still, reduced])
  return (
    <YStack ref={layer as never} width={size} height={size}>
      {children}
    </YStack>
  )
}
