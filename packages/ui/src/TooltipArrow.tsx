import { YStack } from 'tamagui'

import { logical } from './logicalEdges'
import { SIZE_SCALE } from './scales'
import type { TooltipPlacement } from './tooltipPosition'

/** The side of the square the arrow is cut from. */
const SQUARE_PX = SIZE_SCALE.xxs

/**
 * How far the square's centre sits inside the bubble. Its two side corners are on that centre
 * line, so sinking it hides them in the bubble's fill, and what shows is a plain triangle whose
 * sides meet the bubble's edge cleanly rather than a rounded corner sitting on the edge.
 */
const SINK_PX = 1.5

/**
 * How much the square is drawn out towards the control: a longer, narrower point. Narrow because
 * the edge it sits on is short -- a one-line bubble's side is about 9 px between its rounded
 * corners -- and a base wider than that runs into the corners and leaves a notch at each.
 */
const STRETCH = 1.6

/**
 * The tip's rounding. A number because the radius scale starts at 8, which would round a square
 * this small into a disc.
 */
const TIP_RADIUS_PX = 2

/** Half the turned square's width across the edge, less what is sunk into the bubble. */
const SHOWN_PX = SQUARE_PX / Math.SQRT2 - SINK_PX

/** How far the arrow's tip reaches past the bubble. */
export const TOOLTIP_ARROW_REACH_PX = Math.round(SHOWN_PX * STRETCH)

/** Centred along the bubble's edge that faces the control, sunk `SINK_PX` inside it. */
function edge(placement: TooltipPlacement) {
  const across = -SQUARE_PX / 2
  const sunk = SINK_PX - SQUARE_PX / 2
  switch (placement) {
    case 'end':
      return { top: '50%', marginTop: across, ...logical({ insetStart: sunk }) } as const
    case 'start':
      return { top: '50%', marginTop: across, ...logical({ insetEnd: sunk }) } as const
    case 'top':
      return { bottom: sunk, ...logical({ insetStart: '50%', marginStart: across }) } as const
    case 'bottom':
      return { top: sunk, ...logical({ insetStart: '50%', marginStart: across }) } as const
  }
}

/**
 * The bubble's point at its control: a square turned on its corner and drawn out towards the
 * control, with all but its outer point lost in the bubble's own fill. The shape is the same
 * whichever way it points, so nothing in it mirrors for a right-to-left layout; only the edge it
 * sits on does.
 *
 * The bubble's first child, so that what comes after it -- the label -- draws over it.
 */
export function TooltipArrow({ placement }: { placement: TooltipPlacement }) {
  const sideways = placement === 'start' || placement === 'end'
  return (
    <YStack
      position="absolute"
      width={SQUARE_PX}
      height={SQUARE_PX}
      borderRadius={TIP_RADIUS_PX}
      backgroundColor="$messageBubbleIncomingBg"
      // Turned first, then drawn out along the axis that points at the control.
      transform={[sideways ? { scaleX: STRETCH } : { scaleY: STRETCH }, { rotate: '45deg' }]}
      pointerEvents="none"
      {...edge(placement)}
    />
  )
}
