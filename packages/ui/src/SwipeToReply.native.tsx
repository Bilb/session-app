import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { GestureDetector, type PanGestureConfig, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useHaptics } from './haptics'
import { isLayoutRtl } from './layoutDirection'
import { SWIPE_REPLY_THRESHOLD_PX, swipeDrawn } from './swipeMetrics'
import { SwipeReplyCue } from './SwipeReplyCue'
import type { SwipeToReplyProps } from './SwipeToReply.types'

export type { SwipeToReplyProps }

/** Sideways travel before the swipe takes the touch, and the vertical travel that gives it up. */
const SWIPE_ACTIVATE_PX = 10
const SWIPE_FAIL_Y_PX = 10
const FAIL_OFFSET_Y = [-SWIPE_FAIL_Y_PX, SWIPE_FAIL_Y_PX] as [number, number]

/**
 * Towards the leading edge, mirrored in RTL: the other way is the back swipe, which from iOS 26
 * starts anywhere on screen. A vertical move first gives the touch up, so the transcript scrolls.
 */
export function SwipeToReply({ onReply, enabled = true, children }: SwipeToReplyProps) {
  const toward = isLayoutRtl() ? 1 : -1
  const haptics = useHaptics()
  const offset = useSharedValue(0)
  const armed = useSharedValue(false)

  // The pan's config must keep its identity across renders: RNGH re-sends a new one to native and
  // rebuilds its handlers, and a message row re-renders on every send, progress and reaction tick.
  const latestOnReply = useRef(onReply)
  useLayoutEffect(() => {
    latestOnReply.current = onReply
  })
  const reply = useCallback(() => {
    latestOnReply.current()
  }, [])
  const tap = useCallback(() => {
    haptics?.threshold()
  }, [haptics])

  const config = useMemo(
    (): PanGestureConfig => ({
      enabled,
      activeOffsetX: toward * SWIPE_ACTIVATE_PX,
      failOffsetY: FAIL_OFFSET_Y,
      onUpdate: (event) => {
        'worklet'
        const travel = event.translationX * toward
        offset.value = swipeDrawn(travel) * toward
        const past = travel >= SWIPE_REPLY_THRESHOLD_PX
        if (past && !armed.value) scheduleOnRN(tap)
        armed.value = past
      },
      onDeactivate: (event) => {
        'worklet'
        if (armed.value && !event.canceled) scheduleOnRN(reply)
      },
      onFinalize: () => {
        'worklet'
        armed.value = false
        offset.value = withSpring(0)
      },
    }),
    [enabled, toward, offset, armed, tap, reply],
  )
  const pan = usePanGesture(config)

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }))
  const cue = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(offset.value) / SWIPE_REPLY_THRESHOLD_PX, 1)
    return { opacity: progress, transform: [{ scale: interpolate(progress, [0, 1], [0.6, 1]) }] }
  })

  return (
    <GestureDetector gesture={pan}>
      <Animated.View>
        <Animated.View style={[styles.cue, toward < 0 ? styles.cueEnd : styles.cueStart, cue]}>
          <SwipeReplyCue />
        </Animated.View>
        <Animated.View style={row}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

/** Physical edges: the cue sits where the row moves away from, which `toward` already mirrors. */
const styles = StyleSheet.create({
  cue: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  cueEnd: { right: 0 },
  cueStart: { left: 0 },
})
