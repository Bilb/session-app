import { logical } from './logicalEdges'

/**
 * Which side of its control a tooltip opens on. `start` and `end` follow the reading direction, so
 * a tooltip that opens away from the window's edge in English still does in Arabic.
 */
export type TooltipPlacement = 'start' | 'end' | 'top' | 'bottom'

/** The CSS a tooltip's bubble is placed with, relative to the control it describes. */
export type TooltipPositionStyle = Record<string, string | number>

/**
 * Where the bubble sits: outside the control on `placement`'s side, `gapPx` clear of it, and
 * centred along the other axis.
 *
 * The gap is padding on the box the bubble sits in rather than a margin, so it belongs to the
 * tooltip: a pointer crossing it on the way to the bubble is still over the tooltip, and does not
 * close it by leaving.
 *
 * Plain CSS rather than tamagui props, because only the web draws a tooltip and the centring needs
 * a percentage transform tamagui would not pass through. The inline sides are logical, written by
 * `logical`, since tamagui's own logical props do not reach the stylesheet.
 */
export function tooltipPosition(placement: TooltipPlacement, gapPx: number): TooltipPositionStyle {
  switch (placement) {
    case 'end':
      return {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        ...logical({ insetStart: '100%', paddingStart: gapPx }).style,
      }
    case 'start':
      return {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        ...logical({ insetEnd: '100%', paddingEnd: gapPx }).style,
      }
    case 'top':
      return {
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        paddingBottom: gapPx,
      }
    case 'bottom':
      return {
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        paddingTop: gapPx,
      }
  }
}
