import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native'

import type { StepTransitionProps } from './StepTransition.types'
import { isLayoutRtl } from './layoutDirection'
import { stepTravel } from './stepTravel'

export type { StepTransitionProps }

/**
 * How long a push takes.
 *
 * UIKit's own is 0.35s, but the system transition is interruptible and spends much of that
 * settling, so matched exactly it reads as slower than the real thing beside it.
 */
const DURATION_MS = 280

interface Leaving {
  node: ReactNode
  /** Kept with the node: a transition must finish the way it started, even if the prop has moved on. */
  direction: 'forward' | 'back'
}

interface Showing {
  key: string
  /** Which of the two panes is holding the current step. */
  pane: 'a' | 'b'
  leaving: Leaving | null
}

/**
 * The push and pop between onboarding steps.
 *
 * Onboarding is one route with a step inside it rather than a navigation stack, which keeps "there
 * is no history behind onboarding" true. The cost is that nothing animates, so this is a stack's
 * transition without a stack.
 *
 * **Two panes, and the step swaps between them**, rather than one pane whose contents change: a
 * subtree moved to a different position in the tree is unmounted and mounted again, so the screen
 * being left would restart its timers and drop its keyboard mid-slide. Each pane keeps its own
 * instance and only its position moves.
 *
 * The pane holding the current step always renders `children` rather than a remembered copy, so a
 * step that re-renders while nothing is moving shows what it should.
 */
export function StepTransition({
  stepKey,
  direction,
  instant = false,
  children,
}: StepTransitionProps) {
  const { width } = useWindowDimensions()
  const progress = useRef(new Animated.Value(1)).current
  const [showing, setShowing] = useState<Showing>({ key: stepKey, pane: 'a', leaving: null })
  /**
   * The step that was on screen last render.
   *
   * Held because by the time the key has changed the old element is already gone -- this component
   * is only ever handed the current step -- and there is nothing else to slide away.
   */
  const previous = useRef<ReactNode>(children)

  if (showing.key !== stepKey) {
    // Set during render rather than in an effect: an effect runs after the new step has already
    // been painted, so the first frame of every transition would be the finished state.
    progress.setValue(instant ? 1 : 0)
    setShowing({
      key: stepKey,
      pane: otherPane(showing.pane),
      leaving: instant ? null : { node: previous.current, direction },
    })
  }

  useEffect(() => {
    previous.current = children
  })

  useEffect(() => {
    if (showing.leaving === null) return
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    run.start(({ finished }) => {
      // Dropped only once it is off screen. Kept on a cancelled run: another step has started its
      // own transition and owns the pane now.
      if (finished) setShowing((current) => ({ ...current, leaving: null }))
    })
    return () => {
      run.stop()
    }
  }, [showing, progress])

  const moving = showing.leaving
  const way = moving?.direction ?? direction
  const travel = stepTravel(width, way, isLayoutRtl())
  const entering = progress.interpolate({ inputRange: [0, 1], outputRange: [travel.enters, 0] })
  const leaving = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel.leaves] })

  return (
    <Animated.View style={styles.frame}>
      <Animated.View
        style={[
          styles.pane,
          { zIndex: paneLayer('a'), transform: [{ translateX: paneOffset('a') }] },
        ]}
        pointerEvents={showing.pane === 'a' ? 'auto' : 'none'}
      >
        {paneContent('a')}
      </Animated.View>
      <Animated.View
        style={[
          styles.pane,
          { zIndex: paneLayer('b'), transform: [{ translateX: paneOffset('b') }] },
        ]}
        pointerEvents={showing.pane === 'b' ? 'auto' : 'none'}
      >
        {paneContent('b')}
      </Animated.View>
    </Animated.View>
  )

  function paneContent(pane: 'a' | 'b'): ReactNode {
    if (pane === showing.pane) return children
    return moving?.node ?? null
  }

  function paneOffset(pane: 'a' | 'b') {
    if (moving === null) return pane === showing.pane ? 0 : width
    return pane === showing.pane ? entering : leaving
  }

  /**
   * Which of the two is on top.
   *
   * **It changes with the direction, and it has to.** Pushing, the arriving screen covers the one
   * it is leaving; popping, the departing screen is what uncovers the one behind it. Which pane is
   * which alternates every step, so leaving this to the order they are written in puts the wrong
   * one in front every other transition.
   */
  function paneLayer(pane: 'a' | 'b'): number {
    const front = way === 'forward' ? showing.pane : otherPane(showing.pane)
    return pane === front ? 1 : 0
  }
}

function otherPane(pane: 'a' | 'b'): 'a' | 'b' {
  return pane === 'a' ? 'b' : 'a'
}

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden' },
  pane: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
