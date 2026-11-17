import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

import { RING_TURN_MS, type RingSpinProps } from './RingSpin.types'

/** A layer turning about its centre, the native half: a looped rotation on the native driver. */
export function RingSpin({ size, still, children }: RingSpinProps) {
  const turn = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (still) {
      turn.setValue(0)
      return
    }
    const turning = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: RING_TURN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    turning.start()
    return () => {
      turning.stop()
      turn.setValue(0)
    }
  }, [still, turn])
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: [
          { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}
