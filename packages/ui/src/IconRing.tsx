import type { ReactNode } from 'react'
import Svg, { Circle } from 'react-native-svg'
import { YStack } from 'tamagui'

/**
 * lucide's own stroke width. Every glyph in the set is drawn at 2 against a 24 viewBox, so a ring
 * drawn at the same numbers sits on the same optical weight as one that is part of a glyph.
 */
const STROKE = 2

interface IconRingProps {
  size: number
  color: string
  children: ReactNode
}

/**
 * A ring around a glyph, drawn rather than bordered.
 *
 * The two links in the onboarding header have to look like a pair, and one of them gets its circle
 * free: `circleHelp` is a lucide glyph that draws its own. There is no circled link in the set, and
 * a CSS border next to a drawn ring is visibly a different weight -- a border renders at whatever
 * the device pixel ratio makes of 1 or 2, where a stroke is scaled with the glyph. So the second
 * ring is drawn the same way the first one is, at lucide's own numbers.
 */
export function IconRing({ size, color, children }: IconRingProps) {
  return (
    <YStack width={size} height={size} alignItems="center" justifyContent="center">
      <YStack position="absolute" top={0} left={0}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx={12}
            cy={12}
            // Inset by half the stroke, so the ring's outer edge is the icon's edge rather than
            // half a stroke outside it.
            r={12 - STROKE / 2}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
          />
        </Svg>
      </YStack>
      {children}
    </YStack>
  )
}
