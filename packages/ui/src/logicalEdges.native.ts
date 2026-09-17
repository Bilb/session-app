import type { LogicalEdges } from './logicalEdges.types'

export type { LogicalEdges }

/**
 * Spreads onto a component to place it by leading and trailing edges.
 *
 * The native half, where react-native's own props already mean this and mirror with
 * `I18nManager`. Props rather than a style because the CSS logical properties the web half writes
 * are names react-native does not know, and an unknown style key is a warning rather than a
 * position.
 */
export function logical(edges: LogicalEdges): LogicalEdges & { start?: number; end?: number } {
  const { insetStart, insetEnd, ...rest } = edges
  return {
    ...rest,
    ...(insetStart === undefined ? {} : { start: insetStart }),
    ...(insetEnd === undefined ? {} : { end: insetEnd }),
  }
}
