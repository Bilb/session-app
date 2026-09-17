import type { LogicalEdges, LogicalLength } from './logicalEdges.types'

export type { LogicalEdges }

/**
 * Spreads onto a component to place it by leading and trailing edges.
 *
 * The native half, where react-native's own names already mean this and mirror with
 * `I18nManager`. A style rather than props for the same reason the web half is one: only the keys
 * actually given are written, which is what keeps `exactOptionalPropertyTypes` satisfied, and a
 * style spreads onto any component without the prop types having to know these names.
 */
export function logical(edges: LogicalEdges): { style: Record<string, LogicalLength> } {
  const style: Record<string, LogicalLength> = {}
  if (edges.marginStart !== undefined) style['marginStart'] = edges.marginStart
  if (edges.marginEnd !== undefined) style['marginEnd'] = edges.marginEnd
  if (edges.paddingStart !== undefined) style['paddingStart'] = edges.paddingStart
  if (edges.paddingEnd !== undefined) style['paddingEnd'] = edges.paddingEnd
  if (edges.insetStart !== undefined) style['start'] = edges.insetStart
  if (edges.insetEnd !== undefined) style['end'] = edges.insetEnd
  return { style }
}
