import { YStack } from 'tamagui'

import { logical } from './logicalEdges'
import { SIZE_SCALE } from './scales'
import type { TooltipPlacement } from './tooltipPosition'

/** The side of the square the arrow is cut from. */
const SQUARE_PX = SIZE_SCALE.xs

/**
 * The tip's rounding. A number because the radius scale starts at 8, which would round a square
 * this small into a disc.
 */
const TIP_RADIUS_PX = 2

/** How far the arrow's tip reaches past the bubble: half the square's diagonal. */
export const TOOLTIP_ARROW_REACH_PX = Math.round(SQUARE_PX / Math.SQRT2)

/** Centred on the bubble's edge that faces the control. */
function edge(placement: TooltipPlacement) {
  const across = -SQUARE_PX / 2
  switch (placement) {
    case 'end':
      return { top: '50%', marginTop: across, ...logical({ insetStart: across }) } as const
    case 'start':
      return { top: '50%', marginTop: across, ...logical({ insetEnd: across }) } as const
    case 'top':
      return { bottom: across, ...logical({ insetStart: '50%', marginStart: across }) } as const
    case 'bottom':
      return { top: across, ...logical({ insetStart: '50%', marginStart: across }) } as const
  }
}

/**
 * The bubble's point at its control: a square turned on its corner and centred on the edge, so
 * the half outside is a triangle and the half inside is lost in the bubble's own fill. The shape
 * is the same whichever way it points, so nothing in it mirrors for a right-to-left layout; only
 * the edge it sits on does.
 *
 * The bubble's first child, so that what comes after it -- the label -- draws over it.
 */
export function TooltipArrow({ placement }: { placement: TooltipPlacement }) {
  return (
    <YStack
      position="absolute"
      width={SQUARE_PX}
      height={SQUARE_PX}
      borderRadius={TIP_RADIUS_PX}
      backgroundColor="$messageBubbleIncomingBg"
      rotate="45deg"
      pointerEvents="none"
      {...edge(placement)}
    />
  )
}
