import { useLayoutEffect, useRef } from 'react'

import { fittedFontSize } from './fittedFontSize'
import { Text, type TextProps } from './Text'

/**
 * One line of text that shrinks to fit its box rather than truncating, down to half its size.
 *
 * What `adjustsFontSizeToFit` does on iOS and Android, which react-native-web ignores: there it
 * falls back to an ellipsis, so a line that shrinks on a tablet is cut off on desktop. The size
 * comes from comparing the line's full width with the room it is given, and is worked out again
 * whenever that room changes.
 */
export function FitText(props: TextProps) {
  const ref = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      element.style.fontSize = ''
      const size = fittedFontSize(
        parseFloat(getComputedStyle(element).fontSize),
        element.clientWidth,
        element.scrollWidth,
      )
      if (size !== null) element.style.fontSize = `${String(size)}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    if (element.parentElement !== null) observer.observe(element.parentElement)
    return () => {
      observer.disconnect()
    }
  })

  // The ref is the DOM node on the web, which is the only platform this file is for.
  return <Text ref={ref as never} {...props} numberOfLines={1} />
}
