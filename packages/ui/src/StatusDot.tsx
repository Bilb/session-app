import { COLORS } from '@session/theme-tokens'
import { YStack } from 'tamagui'

import { SIZE_SCALE } from './scales'
import { useTokenColor } from './useTokenColor'

/** What a status dot says, by the meaning rather than the colour. */
export type StatusTone = 'positive' | 'warning' | 'danger' | 'neutral'

/**
 * The colour each tone draws in.
 *
 * `positive` is the onion path's fixed green, the same in every theme and never the accent, as all
 * three legacy clients draw it: the network diagram is an illustration, which THEMING.md exempts.
 * The other two are the theme's semantic roles, as legacy Android draws them, because a path that
 * is failing is a warning to read rather than an illustration, and those roles clear 3:1 in every
 * theme where the legacy desktop's fixed amber and red do not.
 */
const TONE_COLOR: Record<StatusTone, string> = {
  positive: COLORS.PATH.DEFAULT,
  warning: '$warningColor',
  danger: '$dangerColor',
  neutral: '$textDisabled',
}

/** The legacy desktop's rail dot. */
const DEFAULT_SIDE_PX = SIZE_SCALE.xs

/** The legacy desktop's glow, a blur in the dot's own colour. */
const DEFAULT_GLOW_PX = 6

/**
 * A small glowing dot that reports a status.
 *
 * Never the only thing that says what the status is: two of the four tones are a red and a green,
 * which a red-green colour-blind reader cannot separate, so whatever draws one also names the state
 * in words -- a tooltip, a label beside it, or the accessibility label of the control it sits on.
 */
export function StatusDot({
  tone,
  sidePx = DEFAULT_SIDE_PX,
  glowPx = DEFAULT_GLOW_PX,
  testID,
}: {
  tone: StatusTone
  sidePx?: number | undefined
  glowPx?: number | undefined
  testID?: string | undefined
}) {
  const color = useTokenColor(TONE_COLOR[tone])
  return (
    <YStack
      width={sidePx}
      height={sidePx}
      borderRadius="$full"
      backgroundColor={color}
      boxShadow={`0px 0px ${String(glowPx)}px 0px ${color}`}
      pointerEvents="none"
      testID={testID}
    />
  )
}
