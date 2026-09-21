import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, type LayoutChangeEvent, View } from 'react-native'

import type { RevealProps } from './Reveal.types'

export type { RevealProps }

/** The client's own timing for a bubble arriving. */
const DURATION_MS = 680

/**
 * Arrives by growing into the space it needs, pushing whatever is above it out of the way.
 *
 * What makes it a push rather than a fade is that the arriving bubble occupies **no height at all**
 * to begin with and grows to its own. The stack is bottom-aligned, so every point it gains moves
 * the bubbles above it up by exactly that much in the same frame -- one animation rather than two
 * asked to agree -- and nothing overlaps, because the space is never occupied before it exists.
 *
 * **The content is absolutely positioned inside the growing box.** A flex child is measured against
 * the space its parent has, and a parent animating up from zero has none, so an ordinary child
 * measures zero and the animation runs from zero to zero. Its height is measured rather than
 * assumed, which a bubble that wraps differently per string requires.
 *
 * **Pinned to the top of that box, not the bottom.** The box's bottom edge is fixed, so a bubble
 * pinned to the top rises as the box grows and is clipped along that edge: it slides into view from
 * a hard line, which is how a message arrives. Pinned to the bottom it holds still while the clip
 * travels up it, and reads as being unrolled.
 *
 * **All of that ends when the arrival does.** Once it has finished the content lays out normally
 * and the box takes whatever height it asks for, so a bubble that re-wraps -- a rotation, a
 * window resized, a longer string in another language -- is not clipped to the height it happened
 * to have on the frame it arrived.
 */
export function Reveal({ children, instant = false }: RevealProps) {
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)
  const [arrived, setArrived] = useState(false)
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (naturalHeight === null) return
    if (instant) {
      progress.setValue(1)
      setArrived(true)
      return
    }
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
      // Height cannot be driven natively, and the whole point is that the height is what moves.
      useNativeDriver: false,
    })
    run.start(({ finished }) => {
      if (finished) setArrived(true)
    })
    // Stopped rather than left running: it drives a height on a view that is going away, which is
    // a set on an unmounted component and a callback that lands after it.
    return () => {
      run.stop()
    }
  }, [naturalHeight, progress, instant])

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height
    // Once only, and never zero: the first pass of a view that has not been laid out yet reports
    // nothing, and taking that as the natural height would animate from zero to zero.
    if (measured <= 0) return
    setNaturalHeight((known) => known ?? measured)
  }

  // Out of the way once it is here: no clip, no measured height, and the content laid out the
  // ordinary way, so it is free to re-wrap.
  if (arrived) return <View>{children}</View>

  return (
    <Animated.View
      // Clipped rather than merely transparent, so the part that has not been made room for yet is
      // not drawn over its neighbour.
      style={{
        overflow: 'hidden',
        opacity: naturalHeight === null ? 0 : progress,
        height:
          naturalHeight === null
            ? 0
            : progress.interpolate({ inputRange: [0, 1], outputRange: [0, naturalHeight] }),
      }}
    >
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        onLayout={naturalHeight === null ? onLayout : undefined}
      >
        {children}
      </View>
    </Animated.View>
  )
}
