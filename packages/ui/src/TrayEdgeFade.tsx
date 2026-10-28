import { useId } from 'react'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { YStack } from 'tamagui'

import { isLayoutRtl } from './layoutDirection'
import { useTokenColor } from './useTokenColor'

/** How far in from the edge the fade reaches. */
export const TRAY_FADE_WIDTH = 40

/**
 * The page's surface fading in over one end of the rail, saying there is more that way. The
 * tray places it over the tiles; it never takes a press meant for them.
 *
 * The surface rather than a fixed black, so it reads as the tiles running out of sight in a light
 * theme as in a dark one.
 */
export function TrayEdgeFade({ side, heightPx }: { side: 'start' | 'end'; heightPx: number }) {
  const color = useTokenColor('$backgroundPrimary')
  // An SVG id is document-wide on the web, and useId's colons are not valid in url(#...).
  const id = `trayFade${useId().replace(/:/g, '')}`
  // SVG coordinates do not mirror: the opaque stop is at x = 0 for the start in LTR and the end
  // in RTL, and at x = 1 otherwise.
  const opaqueAtZero = (side === 'start') !== isLayoutRtl()
  return (
    <YStack width={TRAY_FADE_WIDTH} height={heightPx} pointerEvents="none">
      <Svg width={TRAY_FADE_WIDTH} height={heightPx}>
        <Defs>
          <LinearGradient id={id} x1={opaqueAtZero ? 0 : 1} y1={0} x2={opaqueAtZero ? 1 : 0} y2={0}>
            <Stop offset={0} stopColor={color} stopOpacity={1} />
            <Stop offset={1} stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={TRAY_FADE_WIDTH} height={heightPx} fill={`url(#${id})`} />
      </Svg>
    </YStack>
  )
}
