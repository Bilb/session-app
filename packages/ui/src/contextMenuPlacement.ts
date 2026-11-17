import type { AnchorRect } from './anchorRect'

/**
 * Where a context menu opens: at a pointer (a right-click, a long press), or against an element
 * (the keyboard's Menu key on a focused message), in the layer's own coordinates.
 */
export type MenuAnchor =
  { kind: 'point'; x: number; y: number } | { kind: 'element'; rect: AnchorRect }

export interface Size {
  width: number
  height: number
}

/** A panel's top-left corner, physical, and the most it may grow before it scrolls. */
export interface PanelSpot {
  x: number
  y: number
  maxHeight: number
}

export interface MenuGeometry {
  bounds: Size
  /** Kept clear between a panel and the layer's edge. */
  margin: number
  rtl: boolean
}

/** Moves a span inside `[margin, extent - margin]`, pinned to the start when it is too long. */
function clampSpan(start: number, length: number, extent: number, margin: number): number {
  return Math.max(margin, Math.min(start, extent - margin - length))
}

/** The first of `tops` that holds the whole panel, else `fallback` moved inside the margins. */
function vertical(
  tops: readonly number[],
  fallback: number,
  height: number,
  geometry: MenuGeometry,
) {
  const { bounds, margin } = geometry
  const fits = (y: number) => y >= margin && y + height <= bounds.height - margin
  const y = tops.find(fits) ?? fallback
  return { y: clampSpan(y, height, bounds.height, margin), maxHeight: bounds.height - 2 * margin }
}

/**
 * Where the first panel goes.
 *
 * **At a point** it grows toward the trailing edge and down, as every desktop's context menu does,
 * and flips to grow back from the point on whichever axis runs out of room, so the pointer stays
 * on the menu's corner rather than inside it. **Against an element** it hangs below it from its
 * leading edge, above it when below has no room, and over it when neither has.
 *
 * Always whole inside the margins; a panel taller than the layer is pinned to the top and scrolls.
 */
export function placeMenu(
  anchor: MenuAnchor,
  panel: Size,
  geometry: MenuGeometry,
  gap: number,
): PanelSpot {
  const { bounds, margin, rtl } = geometry
  const fitsAcross = (x: number) => x >= margin && x + panel.width <= bounds.width - margin
  if (anchor.kind === 'point') {
    const trailing = rtl ? anchor.x - panel.width : anchor.x
    const leading = rtl ? anchor.x : anchor.x - panel.width
    const x = fitsAcross(trailing) ? trailing : fitsAcross(leading) ? leading : trailing
    return {
      x: clampSpan(x, panel.width, bounds.width, margin),
      ...vertical([anchor.y, anchor.y - panel.height], anchor.y, panel.height, geometry),
    }
  }
  const { rect } = anchor
  const x = rtl ? rect.x + rect.width - panel.width : rect.x
  const below = rect.y + rect.height + gap
  const above = rect.y - gap - panel.height
  return {
    x: clampSpan(x, panel.width, bounds.width, margin),
    ...vertical([below, above], rect.y, panel.height, geometry),
  }
}

/**
 * Where a submenu goes: beside its parent on the trailing side, its first row level with the row
 * that opened it, overlapping the parent by `overlap` so the two read as one menu. The leading side
 * when the trailing one has no room, and clamped over the parent when neither has.
 */
export function placeSubmenu(
  row: AnchorRect,
  parent: AnchorRect,
  panel: Size,
  geometry: MenuGeometry,
  overlap: number,
  /** The panel's own padding above its first row, so that row lines up rather than the panel. */
  inset: number,
): PanelSpot {
  const { bounds, margin, rtl } = geometry
  const after = parent.x + parent.width - overlap
  const before = parent.x - panel.width + overlap
  const [preferred, flipped] = rtl ? [before, after] : [after, before]
  const fitsAcross = (x: number) => x >= margin && x + panel.width <= bounds.width - margin
  const x = fitsAcross(preferred) ? preferred : fitsAcross(flipped) ? flipped : preferred
  const top = row.y - inset
  return {
    x: clampSpan(x, panel.width, bounds.width, margin),
    ...vertical([], top, panel.height, geometry),
  }
}

/**
 * The inset from the leading edge a physical `x` becomes, since panels are positioned by leading
 * edge (see `panelInset`): Yoga mirrors `left` in a right-to-left layout on native.
 */
export function leadingInset(x: number, width: number, geometry: MenuGeometry): number {
  return geometry.rtl ? geometry.bounds.width - x - width : x
}
