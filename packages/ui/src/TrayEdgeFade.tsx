import { useId } from 'react'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { YStack } from 'tamagui'

import { isLayoutRtl } from './layoutDirection'
import { useTokenColor } from './useTokenColor'

/** What a scrollable end of the staged tray is drawn with. */
export interface EdgeFadeStyle {
  /** A theme token, or a literal colour. */
  color: string
  widthPx: number
  /** At the edge itself, falling to nothing at `widthPx` in. */
  opacity: number
}

/**
 * A gradient for one end of the rail, from the edge inward, saying there is more that way. The
 * tray places it over the tiles; it never takes a press meant for them.
 */
export function TrayEdgeFade({
  side,
  heightPx,
  fade,
}: {
  side: 'start' | 'end'
  heightPx: number
  fade: EdgeFadeStyle
}) {
  const color = useTokenColor(fade.color)
  // An SVG id is document-wide on the web, and useId's colons are not valid in url(#...).
  const id = `trayFade${useId().replace(/:/g, '')}`
  // SVG coordinates do not mirror: the opaque stop is at x = 0 for the start in LTR and the end
  // in RTL, and at x = 1 otherwise.
  const opaqueAtZero = (side === 'start') !== isLayoutRtl()
  return (
    <YStack width={fade.widthPx} height={heightPx} pointerEvents="none">
      <Svg width={fade.widthPx} height={heightPx}>
        <Defs>
          <LinearGradient id={id} x1={opaqueAtZero ? 0 : 1} y1={0} x2={opaqueAtZero ? 1 : 0} y2={0}>
            <Stop offset={0} stopColor={color} stopOpacity={fade.opacity} />
            <Stop offset={1} stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={fade.widthPx} height={heightPx} fill={`url(#${id})`} />
      </Svg>
    </YStack>
  )
}
