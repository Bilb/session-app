import { useTokenColor } from './useTokenColor'
import type { ReactNode } from 'react'
import Svg, { Circle } from 'react-native-svg'
import { YStack } from 'tamagui'

/**
 * lucide's `circle-help`, read out of the icon set: `<circle cx=12 cy=12 r=10>` at
 * `stroke-width: 2` in a 24 viewBox, with round caps and joins.
 *
 * Copied rather than approximated, because a ring beside a glyph that carries its own is either
 * exactly the same or visibly wrong -- and "visibly wrong" here was 2px, twice. A stroke of 2 in a
 * 24 box *measures* about 2.1 once it is scaled down to the box the glyph renders into, which is
 * why measuring the rendered SVG and copying that number made this one thicker rather than equal.
 */
const STROKE = 2
const RADIUS = 10

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
  const stroke = useTokenColor(color)
  return (
    // `position="relative"` is load-bearing, and for the second time: react-native makes every
    // view a containing block and the web makes none, so without it the absolute layer below
    // resolves against whichever ancestor happens to be positioned and the ring lands somewhere
    // else on the page entirely.
    <YStack
      width={size}
      height={size}
      position="relative"
      alignItems="center"
      justifyContent="center"
    >
      {/* `fullscreen` rather than top/left zero: the parent is the 24-square, and an absolute
          child with only two edges pinned takes its own intrinsic size and lands wherever that
          leaves it -- which put the ring in the corner of the window. */}
      <YStack
        fullscreen
        alignItems="center"
        justifyContent="center"
        // Decoration only. An absolute layer over a button swallows the press otherwise -- it sits
        // above the glyph and covers the whole target.
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx={12}
            cy={12}
            r={RADIUS}
            stroke={stroke}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </YStack>
      {children}
    </YStack>
  )
}
