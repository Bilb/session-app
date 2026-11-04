import { RADII } from '@session/theme-tokens'

/**
 * Where a tile stops taking the larger corner.
 *
 * A rounded square is one shape at every size, but not one radius: 12 on a 40 px thumbnail is
 * most of its half-width, so it reads as a squircle rather than as the same tile drawn smaller.
 * Two steps is enough, and a step means the album's small tiles and the list's thumbnails are
 * visibly the same family.
 */
export const TILE_RADIUS_STEP = 64

/** The corner an attachment tile takes at a given side length. */
export function tileRadius(side: number): number {
  return side >= TILE_RADIUS_STEP ? RADII.md : RADII.sm
}

/**
 * What a control sits on when it sits on a photograph.
 *
 * Not a theme token, and deliberately: it is drawn over somebody's picture, and the picture is
 * whatever they sent. A scrim that followed the theme would be lighter on a light theme, which is
 * the wrong direction for something whose job is to separate a glyph from an image.
 */
export const TILE_SCRIM = 'rgba(0, 0, 0, 0.55)'

/**
 * Darker under the "+N" slot: there it covers only the next picture's ThumbHash, whose colours are
 * soft enough to take it, and the count is all the tile has to say.
 */
export const TILE_SLOT_SCRIM = 'rgba(0, 0, 0, 0.75)'

/** How much of `TILE_SCRIM` a tile takes under a pointer and while pressed. */
export const TILE_HOVER_OPACITY = 0.7
export const TILE_PRESS_OPACITY = 1

/**
 * The hairline round a tile with no picture in it yet.
 *
 * `backgroundTertiary` on `backgroundPrimary` is about 1.06:1 in a light theme, and the album is
 * drawn edge to edge with no bubble behind it to supply an edge. Inset rather than a border so it
 * costs no layout, and **on the tile rather than on whatever fills it**: a ring on an inner
 * element is square, and the tile's own clip then takes its corners off instead of curving them.
 */
export const TILE_HAIRLINE_WIDTH = 1

/**
 * The sender's placeholder a tile draws under its picture, or null for the glyph.
 *
 * A placeholder that failed to load draws nothing, so it counts as none: the tile then says what
 * it holds with the glyph and the hairline. Keyed on the url, so a new one gets its own attempt.
 */
export function tilePlaceholder(
  thumbhash: string | null | undefined,
  failedThumbhash: string | null,
): string | null {
  if (thumbhash === undefined || thumbhash === null) return null
  return thumbhash === failedThumbhash ? null : thumbhash
}

/** What a tile's image last reported, and for which url. */
export interface PictureReport {
  uri: string
  loaded: boolean
}

/**
 * Whether a tile shows its picture rather than its placeholder: once the image has reported a load
 * for this very url. Keyed on the url, so a new one starts hidden rather than inheriting the last
 * one's load. A url that never loads leaves the placeholder, which is what a tile without one draws
 * too.
 *
 * A url that `loadedBefore`, in this tile or another, shows before this image reports, unless it
 * reports a failure: a tile remounts when the album moves it to another row, and hiding a picture
 * that is already decoded until the load comes back through JS flashes the placeholder. Nothing
 * empty shows meanwhile, since the placeholder is drawn under the picture rather than instead.
 */
export function showsPicture(
  uri: string | null | undefined,
  report: PictureReport | null,
  loadedBefore: boolean,
): boolean {
  if (uri === undefined || uri === null) return false
  return report?.uri === uri ? report.loaded : loadedBefore
}
