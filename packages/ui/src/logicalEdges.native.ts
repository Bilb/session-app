import type { LogicalEdges, LogicalLength } from './logicalEdges.types'

export type { LogicalEdges }

/** react-native's own leading and trailing names, each with the only values it can carry. */
interface LogicalStyle {
  marginStart?: LogicalLength
  marginEnd?: LogicalLength
  paddingStart?: LogicalLength
  paddingEnd?: LogicalLength
  start?: LogicalLength
  end?: LogicalLength
  borderStartWidth?: number
  borderStartColor?: string
  borderEndWidth?: number
  borderEndColor?: string
}

/**
 * Spreads onto a component to place it by leading and trailing edges.
 *
 * The native half, where react-native's own names already mean this. They resolve against the
 * direction of the node they sit under, which `DirectionRoot` sets and which says why it is that
 * and not `I18nManager`.
 *
 * A style rather than props for the same reason the web half is one: only the keys actually given
 * are written, which is what keeps `exactOptionalPropertyTypes` satisfied, and a style spreads
 * onto any component without the prop types having to know these names.
 */
export function logical(edges: LogicalEdges): { style: LogicalStyle } {
  const style: LogicalStyle = {}
  if (edges.marginStart !== undefined) style.marginStart = edges.marginStart
  if (edges.marginEnd !== undefined) style.marginEnd = edges.marginEnd
  if (edges.paddingStart !== undefined) style.paddingStart = edges.paddingStart
  if (edges.paddingEnd !== undefined) style.paddingEnd = edges.paddingEnd
  if (edges.insetStart !== undefined) style.start = edges.insetStart
  if (edges.insetEnd !== undefined) style.end = edges.insetEnd
  if (edges.borderStartWidth !== undefined) style.borderStartWidth = edges.borderStartWidth
  if (edges.borderStartColor !== undefined) style.borderStartColor = edges.borderStartColor
  if (edges.borderEndWidth !== undefined) style.borderEndWidth = edges.borderEndWidth
  if (edges.borderEndColor !== undefined) style.borderEndColor = edges.borderEndColor
  return { style }
}
