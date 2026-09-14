import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

import type { RevealProps } from './Reveal.types'

export type { RevealProps }

/**
 * Arrives by fading and rising, the way the legacy client's chat bubbles do.
 *
 * **Two halves with different drivers, which is the client's own arrangement**: the opacity runs
 * an `easeIn` over 680ms while the movement is a spring at the same 0.68 speed. Matching only the
 * fade left the bubbles appearing in place, which is what ours did -- the movement is most of what
 * makes it read as a conversation arriving rather than a list filling in.
 *
 * The other half of that effect is not here: the client bottom-aligns the whole stack in a box of
 * fixed height, so each new bubble pushes the earlier ones up. That belongs to the container, not
 * to the bubble, and the landing screen does it.
 */
const DURATION_MS = 680
const RISE_FROM = 12

export function Reveal({ children }: RevealProps) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start()
  }, [progress])

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE_FROM, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}
