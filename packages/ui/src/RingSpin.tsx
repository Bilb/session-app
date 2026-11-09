import { useEffect, useRef } from 'react'
import { YStack } from 'tamagui'

import { RING_TURN_MS, type RingSpinProps } from './RingSpin.types'

/**
 * A layer turning about its centre, the web half: a Web Animation on the layer's element, so the
 * compositor turns it without a render per frame, and a screenshot that disables animations
 * cancels it back to its starting angle.
 */
export function RingSpin({ size, still, children }: RingSpinProps) {
  const layer = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const element = layer.current
    // jsdom has no `animate`; a test draws the starting angle, which is what a still ring is.
    if (still || element === null || typeof element.animate !== 'function') return
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
  }, [still])
  return (
    <YStack ref={layer as never} width={size} height={size}>
      {children}
    </YStack>
  )
}
