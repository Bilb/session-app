import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

import type { UpdateFadeLayerProps } from './UpdateFadeLayer.types'
import { UPDATE_FADE_MS, UPDATE_FADE_SCALE } from './updateIndicatorTiming'

/** A layer fading in or out, the native half. */
export function UpdateFadeLayer({ leaving, instant, children }: UpdateFadeLayerProps) {
  // Starts where the fade starts: a departing layer is a new view, mounted drawn as the old one
  // goes, and an arriving one hidden. Instant starts at the end.
  const from = instant ? (leaving ? 0 : 1) : leaving ? 1 : 0
  const shown = useRef(new Animated.Value(from)).current
  useEffect(() => {
    const target = leaving ? 0 : 1
    if (instant) {
      shown.setValue(target)
      return
    }
    const run = Animated.timing(shown, {
      toValue: target,
      duration: UPDATE_FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    run.start()
    return () => {
      run.stop()
    }
  }, [leaving, instant, shown])
  return (
    <Animated.View
      style={{
        opacity: shown,
        transform: [
          { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [UPDATE_FADE_SCALE, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}
