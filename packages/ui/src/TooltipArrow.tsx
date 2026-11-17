import { YStack } from 'tamagui'

import { logical } from './logicalEdges'
import { RADIUS_SCALE } from './scales'
import type { TooltipPlacement } from './tooltipPosition'

/** The bubble's corner radius, `$sm` in both tooltips: the arrow sits on the edge between them. */
export const TOOLTIP_BUBBLE_RADIUS = '$sm'
const BUBBLE_RADIUS_PX = RADIUS_SCALE.sm

/** How far the arrow's tip reaches past the bubble, whatever its width. */
export const TOOLTIP_ARROW_REACH_PX = 7

/**
 * The arrow's width where it meets the bubble: as wide as `MAX_BASE_PX` where the edge has room,
 * which with the reach makes a right-angled point, and down to `MIN_BASE_PX` where it does not.
 * A one-line bubble's side has about 9 px between its rounded corners; a base wider than the
 * straight part runs into the corners and leaves a notch at each.
 */
const MAX_BASE_PX = 14
const MIN_BASE_PX = 8

/**
 * How far the turned square's centre sits inside the bubble. Its two side corners are on that
 * centre line, so sinking it hides them in the bubble's fill, and what shows is a plain triangle
 * whose sides meet the edge cleanly rather than a rounded corner sitting on it.
 */
const SINK_PX = 1.5

/**
 * The tip's rounding. A number because the radius scale starts at 8, which would round a square
 * this small into a disc.
 */
const TIP_RADIUS_PX = 2

/**
 * The square and its stretch for an edge `edgePx` long: half the base shows past the sunk centre
 * line, and the square is drawn out along the arrow's axis until the tip reaches
 * `TOOLTIP_ARROW_REACH_PX`.
 */
function shape(edgePx: number) {
  const straight = edgePx - 2 * BUBBLE_RADIUS_PX - 1
  const base = Math.min(MAX_BASE_PX, Math.max(MIN_BASE_PX, straight))
  const half = base / 2
  return { squarePx: (half + SINK_PX) * Math.SQRT2, stretch: TOOLTIP_ARROW_REACH_PX / half }
}

/**
 * Centred along the bubble's edge that faces the control, sunk `SINK_PX` inside it. In lengths
 * from the measured bubble rather than percentages, which React Native resolves against a padded
 * parent's content box and the web against its padding box.
 */
function edge(
  placement: TooltipPlacement,
  squarePx: number,
  bubble: { width: number; height: number },
) {
  const sunk = SINK_PX - squarePx / 2
  const down = (bubble.height - squarePx) / 2
  const along = (bubble.width - squarePx) / 2
  switch (placement) {
    case 'end':
      return { top: down, ...logical({ insetStart: sunk }) }
    case 'start':
      return { top: down, ...logical({ insetEnd: sunk }) }
    case 'top':
      return { bottom: sunk, ...logical({ insetStart: along }) }
    case 'bottom':
      return { top: sunk, ...logical({ insetStart: along }) }
  }
}

/**
 * The bubble's point at its control: a square turned on its corner and drawn out towards the
 * control, with all but its outer point lost in the bubble's own fill. The shape is the same
 * whichever way it points, so nothing in it mirrors for a right-to-left layout; only the edge it
 * sits on does.
 *
 * Drawn in an unpadded bubble, with the label's padding on a view of its own beside it, so that its
 * offsets have one box to resolve against on every platform.
 *
 * `bubble` is the bubble's measured size, and nothing is drawn until it is known: the width the
 * point can take depends on the length of the edge it sits on, which a multi-line label makes
 * longer. The bubble's first child, so that what comes after it -- the label -- draws over it.
 */
export function TooltipArrow({
  placement,
  bubble,
}: {
  placement: TooltipPlacement
  bubble: { width: number; height: number } | null
}) {
  if (bubble === null) return null
  const sideways = placement === 'start' || placement === 'end'
  const { squarePx, stretch } = shape(sideways ? bubble.height : bubble.width)
  // Two views rather than one transform list, because the web and React Native compose a list in
  // opposite orders: the square has to be turned first and drawn out after, along the screen's
  // axis, and a parent's transform always applies after its child's.
  return (
    <YStack
      position="absolute"
      width={squarePx}
      height={squarePx}
      transform={[sideways ? { scaleX: stretch } : { scaleY: stretch }]}
      pointerEvents="none"
      {...edge(placement, squarePx, bubble)}
    >
      <YStack
        width={squarePx}
        height={squarePx}
        borderRadius={TIP_RADIUS_PX}
        backgroundColor="$messageBubbleIncomingBg"
        transform={[{ rotate: '45deg' }]}
      />
    </YStack>
  )
}
