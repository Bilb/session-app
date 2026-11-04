import { ALBUM_LONE_MIN_ASPECT, ALBUM_WIDTH } from '@session/basic-types'

/** The seam between tiles. Tight, so the set reads as one object rather than as loose pictures. */
export const ALBUM_SEAM = 4

/** Past this the album stops drawing pictures, and the last tile is the "+N" slot. */
export const ALBUM_MAX_TILES = 5

/**
 * The most elongated shape, width over height, a tile keeps, either way up: a tile is drawn
 * between 9:21 and 21:9, and a picture past that is drawn at the limit and cropped to it.
 *
 * It is where libsession crops its thumbnails, so a tile never asks for more of the picture than
 * the thumbnail holds - and every popular phone screenshot, 9:16 to 9:21, keeps its shape.
 */
export const ALBUM_MAX_ASPECT = 21 / 9

/**
 * The shortest row an album of several draws, at the narrowest album; it scales with the width.
 * Past it the row's tiles are cropped instead.
 */
export const ALBUM_MIN_ROW_HEIGHT_PX = 64

/** How tall the album of several aims to be, as a share of its width. */
const ALBUM_TARGET_HEIGHT_SHARE = 0.85

/**
 * The "+N" slot's shape: a square, so it is always big enough to read a count of two digits.
 * Among narrower pictures it takes the widest of their shapes, or it would be the largest tile
 * whatever row it went in.
 */
const SLOT_ASPECT = 1

/**
 * What a candidate pays per px a row's height is clamped by: as much as 10 px off the target
 * height. So a small crop can still win over a split much further from the target - 5 px of crop
 * over one more than 50 px further.
 */
const CROP_COST_PER_PX = 10

/**
 * What a candidate pays when the slot comes out the largest tile, or tied for it. Beyond any
 * height or crop cost: a count is a footnote to the set, and on the biggest tile it reads as the
 * point of it.
 */
const SLOT_LARGEST_COST = 1_000_000

/** What a candidate pays when the slot is one of the two largest tiles: still too prominent. */
const SLOT_TOP_TWO_COST = 300

/** Past this share of the width an album dominates the transcript, so each px costs more. */
const TALL_FROM_SHARE = 1.5
const TALL_COST_PER_PX = 10

/** A tile whose shorter side is under this reads as a sliver; each px short costs. */
const SLIVER_PX = 56
const SLIVER_COST_PER_PX = 10

/** Past this ratio of the largest tile's area to the smallest, each doubling costs. */
const SPREAD_FROM = 4
const SPREAD_COST_PER_DOUBLING = 90

/** Crop px a candidate may exceed the plain choice's by and still count as cropping no more. */
const CROP_SLACK_PX = 1e-6

/**
 * From this shape, width over height, two pictures are stacked whatever else fits: a landscape
 * needs the album's whole width to be read. Squarer pairs keep the nearest fit, as a stack of two
 * near-squares would be twice as tall as wide.
 */
const STACKED_PAIR_MIN_ASPECT = 1.3

/** How close two tiles' areas are to count as the same size, past rounding to whole px. */
const SAME_AREA_SHARE = 0.03

export interface AlbumTileRect {
  /** Which attachment of the viewable set this is. */
  at: number
  /** From the album's leading edge, so it mirrors with the reading direction. */
  x: number
  y: number
  width: number
  height: number
}

export interface AlbumRow {
  height: number
  /** In the sender's order from the leading edge. Their widths and seams sum to the album's. */
  tiles: AlbumTileRect[]
}

export interface AlbumLayout {
  rows: AlbumRow[]
  /**
   * How many pictures come after the album's last tile, which is the count the slot shows: seven
   * pictures draw "+2". The picture under the slot is not among them. 0 when it draws all.
   */
  overflow: number
  width: number
  height: number
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/**
 * The shape a tile is drawn at for a picture of this shape: clamped to the album's limits, and a
 * square where nothing said what shape it is.
 */
export function tileAspect(aspect: number | undefined): number {
  if (aspect === undefined || !Number.isFinite(aspect) || aspect <= 0) return 1
  return clamp(aspect, 1 / ALBUM_MAX_ASPECT, ALBUM_MAX_ASPECT)
}

/**
 * One picture on its own: as wide as the album down to `ALBUM_LONE_MIN_ASPECT`; a taller picture
 * keeps that height and is drawn narrower, down to 9:21, past which it is cropped.
 * Never taller than `maxHeightPx` either: a picture that would be is drawn that tall and narrower.
 */
function loneTile(
  aspect: number | undefined,
  width: number,
  maxHeightPx: number | undefined,
): AlbumTileRect {
  const shape = tileAspect(aspect)
  const tallest = Math.min(width / ALBUM_LONE_MIN_ASPECT, maxHeightPx ?? Number.POSITIVE_INFINITY)
  const natural = width / shape
  if (natural <= tallest)
    return { at: 0, x: 0, y: 0, width, height: Math.max(Math.round(natural), 1) }
  // Too tall for the album's width: as tall as allowed, and as wide as its shape then makes it.
  const height = Math.max(Math.round(tallest), 1)
  return { at: 0, x: 0, y: 0, width: Math.max(Math.round(height * shape), 1), height }
}

/**
 * Step 1, the shapes: each picture's, clamped, and the slot's in place of the last where pictures
 * are left over.
 */
function tileShapes(aspects: readonly (number | undefined)[], count: number, slotted: boolean) {
  const shapes = aspects.slice(0, count).map(tileAspect)
  if (slotted) shapes[count - 1] = Math.min(SLOT_ASPECT, Math.max(...shapes.slice(0, -1)))
  return shapes
}

/**
 * Step 2, the candidates: one row, or two split at every point. The slot never has a row to
 * itself: alone it would stretch the album's width under a row of smaller pictures. Two pictures
 * at least `STACKED_PAIR_MIN_ASPECT` wide are only ever stacked.
 */
function rowSplits(shapes: readonly number[], slotted: boolean): number[][] {
  const count = shapes.length
  if (count === 2 && shapes.every((shape) => shape >= STACKED_PAIR_MIN_ASPECT)) return [[1, 1]]
  const splits = [[count]]
  for (let first = 1; first < count; first += 1) {
    if (slotted && first === count - 1) continue
    splits.push([first, count - first])
  }
  return splits
}

/**
 * One row at a whole-px height, its tiles' widths in proportion to their shapes.
 *
 * Each tile ends where the running share of the width rounds to, and the last ends at the width
 * itself, so the rounding never leaves a gap or overflows: the widths and seams sum to `width`.
 */
function placeRow(
  shapes: readonly number[],
  first: number,
  width: number,
  height: number,
  y: number,
): AlbumRow {
  const inner = width - ALBUM_SEAM * (shapes.length - 1)
  const sum = shapes.reduce((total, shape) => total + shape, 0)
  let before = 0
  let edge = 0
  const tiles = shapes.map((shape, i): AlbumTileRect => {
    const start = edge
    before += shape
    edge = i === shapes.length - 1 ? inner : Math.round((inner * before) / sum)
    return { at: first + i, x: start + i * ALBUM_SEAM, y, width: edge - start, height }
  })
  return { height, tiles }
}

/**
 * Step 3, a candidate placed: each row at the height that makes its tiles fill the width, clamped
 * between the shortest row and the album's width, with how many px the clamping cost.
 */
function placeRows(
  shapes: readonly number[],
  sizes: readonly number[],
  width: number,
  minRowHeightPx: number,
) {
  const highest = Math.max(width, 1)
  const lowest = Math.min(minRowHeightPx, highest)
  const rows: AlbumRow[] = []
  let first = 0
  let y = 0
  let cropPx = 0
  for (const size of sizes) {
    const row = shapes.slice(first, first + size)
    const sum = row.reduce((total, shape) => total + shape, 0)
    const natural = (width - ALBUM_SEAM * (row.length - 1)) / sum
    const clamped = clamp(natural, lowest, highest)
    cropPx += Math.abs(natural - clamped)
    const placed = placeRow(row, first, width, Math.round(clamped), y)
    rows.push(placed)
    y += placed.height + ALBUM_SEAM
    first += size
  }
  return { rows, height: y - ALBUM_SEAM, cropPx }
}

const areasOf = (rows: readonly AlbumRow[]) =>
  rows.flatMap((row) => row.tiles.map((tile) => tile.width * tile.height))

/**
 * What the slot's size costs: `SLOT_LARGEST_COST` where no tile is larger past rounding, and
 * `SLOT_TOP_TWO_COST` where one is. Nothing where every tile is the same size, where no layout
 * could do otherwise.
 */
function slotCost(rows: readonly AlbumRow[]): number {
  const areas = areasOf(rows)
  const slot = areas.pop() ?? 0
  if (areas.length === 0 || slot <= Math.min(...areas) * (1 + SAME_AREA_SHARE)) return 0
  const larger = areas.filter((area) => area > slot * (1 + SAME_AREA_SHARE)).length
  return larger === 0 ? SLOT_LARGEST_COST : larger === 1 ? SLOT_TOP_TWO_COST : 0
}

/**
 * What makes a candidate look broken rather than merely off its height: slivers, a wide spread of
 * tile sizes, and an album taller than `TALL_FROM_SHARE` of its width.
 */
function balanceCost(rows: readonly AlbumRow[], height: number, width: number): number {
  const areas = areasOf(rows)
  let cost = Math.max(0, height - TALL_FROM_SHARE * width) * TALL_COST_PER_PX
  for (const row of rows)
    for (const tile of row.tiles)
      cost += Math.max(0, SLIVER_PX - Math.min(tile.width, tile.height)) * SLIVER_COST_PER_PX
  const spread = Math.max(...areas) / Math.min(...areas)
  if (Number.isFinite(spread))
    cost += Math.max(0, Math.log2(spread / SPREAD_FROM)) * SPREAD_COST_PER_DOUBLING
  return cost
}

/**
 * Where each tile of an album goes, from its pictures' shapes, in the sender's order.
 *
 * **Justified rows.** The first `ALBUM_MAX_TILES` pictures are laid out as one row, or as two
 * split at every point, each row at the one height that makes its tiles, at their own shapes, fill
 * the width. Each pays its distance from `ALBUM_TARGET_HEIGHT_SHARE` of the width; one whose rows
 * would fall outside the shortest row or the width is clamped there and pays `CROP_COST_PER_PX`
 * per px of the crop, so a crop of c px beats only a split more than 10c px further from the
 * target. The nearest is the plain choice.
 *
 * **Balance.** Candidates also pay `balanceCost`, and the cheapest wins, with two limits: none may
 * crop more than the plain choice, and where the plain choice is two rows, one row is ruled out.
 * Balancing never costs the album more of its pictures, and never flattens a grid into a strip of
 * small tiles.
 *
 * **Two landscapes** of `STACKED_PAIR_MIN_ASPECT` or wider are always stacked, each the album's
 * width; see `rowSplits`.
 *
 * **"+N".** Past `ALBUM_MAX_TILES`, the last tile is a square slot carrying the count of the rest,
 * never alone on its row, never the largest tile, and where avoidable not among the two largest.
 *
 * **One picture** keeps its own shape: see `loneTile`. `loneMaxHeightPx` caps its height, as both
 * layouts do.
 *
 * `aspects` are width over height; an absent or unusable one draws a square. Shapes come from the
 * sender's metadata, so the layout is settled before a byte of any picture arrives, and a tile's
 * placeholder takes its final rect.
 */
export function albumLayout(
  aspects: readonly (number | undefined)[],
  width: number,
  { loneMaxHeightPx }: { loneMaxHeightPx?: number | undefined } = {},
): AlbumLayout {
  const whole = Math.max(Math.floor(width), 0)
  const count = Math.min(aspects.length, ALBUM_MAX_TILES)
  const overflow = aspects.length - count
  if (count === 0) return { rows: [], overflow, width: whole, height: 0 }
  if (count === 1) {
    const tile = loneTile(aspects[0], whole, loneMaxHeightPx)
    const rows = [{ height: tile.height, tiles: [tile] }]
    return { rows, overflow, width: tile.width, height: tile.height }
  }

  const slotted = overflow > 0
  const shapes = tileShapes(aspects, count, slotted)
  const minRowHeightPx = Math.round((ALBUM_MIN_ROW_HEIGHT_PX / ALBUM_WIDTH) * whole)
  const target = whole * ALBUM_TARGET_HEIGHT_SHARE

  // Step 4: place and score every candidate.
  const candidates = rowSplits(shapes, slotted).map((sizes) => {
    const { rows, height, cropPx } = placeRows(shapes, sizes, whole, minRowHeightPx)
    const slot = slotted ? slotCost(rows) : 0
    const plain =
      Math.abs(height - target) +
      cropPx * CROP_COST_PER_PX +
      (slot === SLOT_LARGEST_COST ? SLOT_LARGEST_COST : 0)
    const score = plain + (slot === SLOT_TOP_TWO_COST ? slot : 0) + balanceCost(rows, height, whole)
    return { rows, height, cropPx, plain, score }
  })
  // Step 5: keep the cheapest within the limits, the first of equals.
  const cheapest = <T>(items: T[], cost: (item: T) => number) =>
    items.reduce((best, item) => (cost(item) < cost(best) ? item : best))
  const plain = cheapest(candidates, (candidate) => candidate.plain)
  const allowed = candidates.filter(
    (c) =>
      c.cropPx <= plain.cropPx + CROP_SLACK_PX && (plain.rows.length === 1 || c.rows.length > 1),
  )
  const best = cheapest(allowed, (c) => c.score)
  return { rows: best.rows, overflow, width: whole, height: best.height }
}

/** The last tile drawn, which is the slot where the album has one. */
export function lastTile(layout: AlbumLayout): AlbumTileRect | undefined {
  const tiles = layout.rows[layout.rows.length - 1]?.tiles ?? []
  return tiles[tiles.length - 1]
}
