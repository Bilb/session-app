import { useEffect, useRef, useState } from 'react'
import {
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native'

import type { SlidePagerProps } from './SlidePager.types'

export type { SlidePagerProps }

const FILL = { flex: 1 } as const

/**
 * Where the pager is the whole width, its neighbours are off screen anyway, and a page may draw
 * past the pager's box: the camera preview runs under the home indicator.
 */
const UNCLIPPED = { overflow: 'visible' } as const

/** The page a scroll position is at. React Native reports it from the leading edge either way. */
function pageAt(event: NativeSyntheticEvent<NativeScrollEvent>, width: number): number {
  return width === 0 ? 0 : Math.round(event.nativeEvent.contentOffset.x / width)
}

/**
 * The pages of a tabbed screen, laid side by side and swiped or slid across.
 *
 * **A native paging scroll view, so a swipe moves between the pages.** That is also what settles
 * the swipe against the stack's: from iOS 26 the stack goes back on a swipe from anywhere on the
 * screen, and it waits for a horizontally scrolling view under the finger to decline first. So a
 * swipe towards the previous page goes to it, and only a swipe from the screen's edge -- which
 * always wins -- or one on the first page's leading side leaves the screen.
 *
 * Every page stays mounted. That is what keeps a half-typed recovery phrase there after a look at
 * the other tab: a page taken out of the tree loses everything it was holding.
 */
export function SlidePager({
  index,
  onIndexChange,
  instant = false,
  clip = false,
  fitsPage = false,
  children,
}: SlidePagerProps) {
  /**
   * The pager's own width, which is each page's.
   *
   * **Measured rather than read off the window.** The two are the same on a phone, where the pager
   * is the screen, and are not on a tablet, where it is a column inside one.
   */
  const [width, setWidth] = useState(0)
  const scroller = useRef<ScrollViewInstance>(null)
  /** Where the scroll view is, so a page the person swiped to is not scrolled to again. */
  const showing = useRef(index)

  useEffect(() => {
    if (width === 0 || showing.current === index) return
    showing.current = index
    scroller.current?.scrollTo({ x: index * width, animated: !instant })
  }, [index, width, instant])

  return (
    <ScrollView
      ref={scroller}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      // Leaving a page with the keyboard up leaves the field it belongs to.
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      // Anything a page means to draw outside this box -- the wide back control hangs off the
      // column's leading edge -- belongs to whatever lays the pager out, not inside a page.
      style={[fitsPage ? null : FILL, clip ? null : UNCLIPPED]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width
        if (next === width) return
        setWidth(next)
        // Back to the page showing at the new width, which a rotation would otherwise leave
        // part-way between two.
        scroller.current?.scrollTo({ x: showing.current * next, animated: false })
      }}
      onMomentumScrollEnd={(event) => {
        const page = pageAt(event, width)
        if (page === showing.current) return
        showing.current = page
        onIndexChange?.(page)
      }}
    >
      {children.map((page, at) => (
        // The pages are a fixed list in source order, so their position is what identifies them.
        <View key={String(at)} style={{ width }}>
          {page}
        </View>
      ))}
    </ScrollView>
  )
}
