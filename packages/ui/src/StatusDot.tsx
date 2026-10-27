import { COLORS } from '@session/theme-tokens'
import Svg, { Circle, Path } from 'react-native-svg'
import { YStack } from 'tamagui'

import { usePaneSurface } from './paneSurface'
import { SIZE_SCALE } from './scales'
import { useTokenColor } from './useTokenColor'

/** What a status dot says, by the meaning rather than the colour. */
export type StatusTone = 'positive' | 'warning' | 'danger' | 'neutral'

/**
 * The colour each tone draws in.
 *
 * `positive` is the onion path's fixed green, the same in every theme and never the accent: the
 * network diagram is an illustration, which THEMING.md exempts. The other two are the theme's
 * semantic roles, because a path that is failing is a warning to read rather than an illustration,
 * and those roles clear 3:1 in every theme where a fixed amber and red do not.
 */
const TONE_COLOR: Record<StatusTone, string> = {
  positive: COLORS.PATH.DEFAULT,
  warning: '$warningColor',
  danger: '$dangerColor',
  neutral: '$textDisabled',
}

/** Big enough for the glyph inside it to read. */
const DEFAULT_SIDE_PX = SIZE_SCALE.sm

/** A blur in the dot's own colour, wide enough to read as a soft light. */
const DEFAULT_GLOW_PX = 10

/** Every glyph is drawn on a 24-unit grid, scaled to the dot. */
const GRID = 24

/**
 * The glyph in each tone's disc, so the state reads by shape as well as colour: a check, an
 * ellipsis for a path still being built, a cross, and a question mark. A cross rather than a dash
 * for no path: at this size a dash and the ellipsis are both a bar through the middle.
 */
function Glyph({ tone }: { tone: StatusTone }) {
  // Black on every tone and in every theme: the tones are light enough to carry it, and one ink
  // keeps the four reading as one set.
  const ink = COLORS.BLACK
  const stroke = {
    stroke: ink,
    strokeWidth: 3.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  } as const
  switch (tone) {
    case 'positive':
      return <Path d="M6.5 12.5 10.5 16.5 17.5 8" {...stroke} />
    case 'warning':
      return (
        <>
          <Circle cx={6.8} cy={12} r={2} fill={ink} />
          <Circle cx={12} cy={12} r={2} fill={ink} />
          <Circle cx={17.2} cy={12} r={2} fill={ink} />
        </>
      )
    case 'danger':
      return <Path d="M8 8 16 16M16 8 8 16" {...stroke} />
    case 'neutral':
      return <Path d="M12 18h.01M9.3 9.5a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 3.6" {...stroke} />
  }
}

/**
 * A small glowing disc that reports a status, with a glyph that names it by shape.
 *
 * Still never the only thing that says what the status is: whatever draws one also names the state
 * in words -- a tooltip, a label beside it, or the accessibility label of the control it sits on.
 *
 * `ringPx` cuts it out of what it overlaps, a ring in the pane's own surface: the home avatar's
 * badge sits on the avatar's edge. The ring is a disc of its own behind the dot rather than a
 * border on it: a border's anti-aliased outer edge lets the background under it show through, a
 * fringe of the dot's colour round the ring.
 */
export function StatusDot({
  tone,
  sidePx = DEFAULT_SIDE_PX,
  glowPx = DEFAULT_GLOW_PX,
  ringPx = 0,
  testID,
}: {
  tone: StatusTone
  sidePx?: number | undefined
  glowPx?: number | undefined
  ringPx?: number | undefined
  testID?: string | undefined
}) {
  const color = useTokenColor(TONE_COLOR[tone])
  const surface = useTokenColor(usePaneSurface())
  return (
    <YStack
      width={sidePx + 2 * ringPx}
      height={sidePx + 2 * ringPx}
      borderRadius="$full"
      backgroundColor={ringPx > 0 ? surface : 'transparent'}
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
      testID={testID}
    >
      <YStack
        width={sidePx}
        height={sidePx}
        borderRadius="$full"
        backgroundColor={color}
        boxShadow={`0px 0px ${String(glowPx)}px 0px ${color}`}
        alignItems="center"
        justifyContent="center"
      >
        <Svg width={sidePx} height={sidePx} viewBox={`0 0 ${String(GRID)} ${String(GRID)}`}>
          <Glyph tone={tone} />
        </Svg>
      </YStack>
    </YStack>
  )
}
