import type { LogicalEdges } from './logicalEdges.types'

export type { LogicalEdges }

/**
 * Spreads onto a component to place it by leading and trailing edges.
 *
 * **The web half, and the reason this wrapper exists at all: tamagui's own logical props do not
 * reach the stylesheet here.** `marginStart`, `paddingEnd` and `end` each compile to a class --
 * `_marginStart--36px` is really emitted -- and no rule backs it, so the computed value stays 0
 * and the element does not move. Measured: a back control given `marginStart: -36` sat flush
 * against its column, and setting `margin-inline-start` on the same element moved it 36 points
 * out. Written as a style rather than as props so it wins over the class either way.
 *
 * The properties themselves are the CSS logical ones, which browsers have supported for years and
 * which mirror off the document's `dir`. That is what `applyDirection` sets.
 */
export function logical(edges: LogicalEdges): { style: Record<string, number> } {
  const style: Record<string, number> = {}
  if (edges.marginStart !== undefined) style['marginInlineStart'] = edges.marginStart
  if (edges.marginEnd !== undefined) style['marginInlineEnd'] = edges.marginEnd
  if (edges.paddingStart !== undefined) style['paddingInlineStart'] = edges.paddingStart
  if (edges.paddingEnd !== undefined) style['paddingInlineEnd'] = edges.paddingEnd
  if (edges.insetStart !== undefined) style['insetInlineStart'] = edges.insetStart
  if (edges.insetEnd !== undefined) style['insetInlineEnd'] = edges.insetEnd
  return { style }
}
