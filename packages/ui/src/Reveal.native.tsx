import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, type LayoutChangeEvent, View } from 'react-native'

import type { RevealProps } from './Reveal.types'

export type { RevealProps }

/** The client's own timing for a bubble arriving. */
const DURATION_MS = 680

/**
 * Arrives by growing into the space it needs, pushing whatever is above it out of the way.
 *
 * **This is the fourth attempt**, and the three that failed are worth recording because each looked
 * plausible. Fading the bubble in animated the bubble and said nothing about the ones already on
 * screen, which jumped. Adding a layout animation moved them, but the newcomer was already at full
 * height while they slid, so it overlapped them on the way past. Growing a wrapper's height with
 * the content as an ordinary child inside it showed nothing at all: a flex child is measured
 * against the space its parent has, and a parent animating up from zero has none, so the content
 * measured zero and the animation ran from zero to zero.
 *
 * What makes it a push is that the arriving bubble occupies **no height at all** to begin with and
 * grows to its own: the stack is bottom-aligned, so every point it gains moves the bubbles above it
 * up by exactly that much, in the same frame, because it is one animation rather than two being
 * asked to agree. Nothing overlaps because the space is never occupied before it exists.
 *
 * The content is taken out of the flow to make that possible -- absolutely positioned inside the
 * growing box, which is what keeps it measurable at its natural size rather than squashed to
 * whatever height the animation has reached. Its height is measured rather than guessed, because a
 * bubble whose height was assumed would be wrong for every string that wraps differently.
 *
 * **Pinned to the top of that box, not the bottom.** The box's own bottom edge is fixed -- the
 * stack is bottom-aligned -- so a bubble pinned to the top rises as the box grows and is clipped
 * along that fixed edge: it slides up into view from a hard line, which is how a message arrives.
 * Pinned to the bottom it did the opposite, holding still while the clip travelled up it, and the
 * bubble looked like it was being unrolled rather than arriving.
 */
export function Reveal({ children, instant = false }: RevealProps) {
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (naturalHeight === null) return
    if (instant) {
      progress.setValue(1)
      return
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
      // Height cannot be driven natively, and the whole point is that the height is what moves.
      useNativeDriver: false,
    }).start()
  }, [naturalHeight, progress, instant])

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height
    // Once only, and never zero: the first pass of a view that has not been laid out yet reports
    // nothing, and taking that as the natural height would animate from zero to zero.
    if (measured <= 0) return
    setNaturalHeight((known) => known ?? measured)
  }

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
