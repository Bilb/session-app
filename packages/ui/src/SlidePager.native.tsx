import { useEffect, useRef } from 'react'
import { Animated, Easing, useWindowDimensions, View } from 'react-native'

import type { SlidePagerProps } from './SlidePager.types'

export type { SlidePagerProps }

/**
 * How long a page takes to slide. Android's own tab transition.
 *
 * Shorter than a navigation push, and deliberately: moving between tabs is not moving between
 * screens, and a tab bar that takes as long as a stack does reads as heavier than it is.
 */
const DURATION_MS = 250

/**
 * The pages of a tabbed screen, laid side by side and slid across.
 *
 * **Both pages move together, at the same rate**, which is what makes it a pager rather than a
 * push: a push has the arriving screen cover the one it is leaving, and the two travel different
 * distances. Here the pages are one strip that slides, because they are two views of the same
 * screen rather than two screens.
 *
 * Every page stays mounted at its own offset. That is what keeps a half-typed recovery phrase
 * there after a look at the other tab, and it is why the pages are positioned rather than swapped:
 * a page taken out of the tree loses everything it was holding.
 */
export function SlidePager({ index, instant = false, children }: SlidePagerProps) {
  const { width } = useWindowDimensions()
  const at = useRef(new Animated.Value(index)).current

  useEffect(() => {
    if (instant) {
      at.setValue(index)
      return
    }
    const run = Animated.timing(at, {
      toValue: index,
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    run.start()
    return () => {
      run.stop()
    }
  }, [index, instant, at])

  return (
    // Not clipped. A page at rest off screen is a full width away, so it is outside the window
    // already and there is nothing for a clip to catch -- and clipping here would stop a page
    // reaching under the home indicator, which a camera preview is supposed to do.
    <View style={{ flex: 1 }}>
      {children.map((page, at_) => (
        <Animated.View
          // The pages are a fixed list in source order, so their position is what identifies them.
          key={String(at_)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            transform: [
              {
                translateX: at.interpolate({
                  inputRange: [at_ - 1, at_, at_ + 1],
                  outputRange: [width, 0, -width],
                }),
              },
            ],
          }}
          pointerEvents={at_ === index ? 'auto' : 'none'}
        >
          {page}
        </Animated.View>
      ))}
    </View>
  )
}
