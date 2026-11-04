import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing } from 'react-native'

import { RING_TURN_MS, type RingSpinProps } from './RingSpin.types'

/** The system's Reduce Motion, followed while mounted. False until the first answer arrives. */
function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let live = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (live) setReduced(enabled)
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      live = false
      subscription.remove()
    }
  }, [])
  return reduced
}

/** A layer turning about its centre, the native half: a looped rotation on the native driver. */
export function RingSpin({ size, still, children }: RingSpinProps) {
  const turn = useRef(new Animated.Value(0)).current
  const reduced = useReduceMotion()
  useEffect(() => {
    if (still || reduced) {
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
  }, [still, reduced, turn])
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
