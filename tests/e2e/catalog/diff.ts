import pixelmatch from 'pixelmatch'
import pngjs from 'pngjs'

/** An RGBA picture, four bytes a pixel, rows top to bottom. */
export interface Picture {
  width: number
  height: number
  data: Uint8Array
}

export type PageStatus = 'changed' | 'added' | 'removed' | 'unchanged'

/**
 * Argos's default sensitivity. Every tolerance below is multiplied by twice this, as Argos's own
 * `threshold` does, so 0 counts any pixel that is not anti-aliasing and 1 doubles every tolerance.
 */
export const ARGOS_SENSITIVITY = 0.5

/**
 * Argos's two passes (argos-ci.com/docs/diff-algorithm), each with anti-aliased pixels detected
 * and left out. The tolerant one catches a small change of shape, the colour-sensitive one a faint
 * change of colour across a large area; each is discarded when it finds too little. pixelmatch 7
 * measures colour as odiff, which Argos runs, does: a YIQ distance under the same threshold.
 */
const PASSES = [
  { colour: 0.15, floor: (total: number) => Math.min(20, total * 0.0002) },
  { colour: 0.0225, floor: (total: number) => total * 0.03 },
] as const

/** What a page's padding is filled with when its size changed: colours no catalog page draws. */
const BEFORE_PADDING = [255, 0, 255, 255] as const
const AFTER_PADDING = [0, 255, 0, 255] as const

export interface Size {
  width: number
  height: number
}

/** The verdict on a page drawn on both sides. */
export interface PageDiff {
  status: 'changed' | 'unchanged'
  /** Pixels counted as different by the pass that decided, 0 when unchanged. */
  differingPixels: number
  /** Pixels compared: the larger width by the larger height when the size changed. */
  totalPixels: number
  before: Size
  after: Size
  /** The `after` picture faded, with what differs drawn over it; absent when unchanged. */
  highlight?: Picture | undefined
}

export function decodePng(bytes: Uint8Array): Picture {
  const png = pngjs.PNG.sync.read(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) }
}

export function encodePng(picture: Picture): Buffer {
  const png = new pngjs.PNG({ width: picture.width, height: picture.height })
  png.data = Buffer.from(picture.data)
  return pngjs.PNG.sync.write(png)
}

/** A PNG's size, read from its header without decoding it. */
export function pngSize(bytes: Uint8Array): Size {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The signature is 8 bytes and IHDR's length and type 8 more; width and height follow.
  if (bytes.byteLength < 24) throw new Error('not a PNG: too short for a header')
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

/** Whether every pixel is the same colour: what a window that never painted is captured as. */
export function isBlank(picture: Picture): boolean {
  const { data } = picture
  for (let at = 4; at < data.length; at += 4)
    if (
      data[at] !== data[0] ||
      data[at + 1] !== data[1] ||
      data[at + 2] !== data[2] ||
      data[at + 3] !== data[3]
    )
      return false
  return true
}

function sizeOf(picture: Picture): Size {
  return { width: picture.width, height: picture.height }
}

/** `picture` at the top left of a `size` canvas, the rest filled with `fill`. */
function padded(picture: Picture, size: Size, fill: readonly number[]): Picture {
  if (picture.width === size.width && picture.height === size.height) return picture
  const data = new Uint8Array(size.width * size.height * 4)
  for (let at = 0; at < data.length; at += 4) data.set(fill, at)
  for (let row = 0; row < picture.height; row++)
    data.set(
      picture.data.subarray(row * picture.width * 4, (row + 1) * picture.width * 4),
      row * size.width * 4,
    )
  return { ...size, data }
}

function match(before: Picture, after: Picture, colour: number): { count: number; out: Picture } {
  const out = {
    width: before.width,
    height: before.height,
    data: new Uint8Array(before.data.length),
  }
  const count = pixelmatch(before.data, after.data, out.data, before.width, before.height, {
    threshold: colour,
    includeAA: false,
  })
  return { count, out }
}

/**
 * Compares a page's two pictures as Argos would. A page whose size changed is changed whatever its
 * pixels say, with the area only one side covers counted as different.
 */
export function diffPictures(
  before: Picture,
  after: Picture,
  sensitivity: number = ARGOS_SENSITIVITY,
): PageDiff {
  const scale = 2 * sensitivity
  const sizes = { before: sizeOf(before), after: sizeOf(after) }
  const resized = before.width !== after.width || before.height !== after.height

  if (resized) {
    const canvas = {
      width: Math.max(before.width, after.width),
      height: Math.max(before.height, after.height),
    }
    const tolerant = PASSES[0]
    const { count, out } = match(
      padded(before, canvas, BEFORE_PADDING),
      padded(after, canvas, AFTER_PADDING),
      tolerant.colour * scale,
    )
    return {
      status: 'changed',
      differingPixels: count,
      totalPixels: canvas.width * canvas.height,
      ...sizes,
      highlight: out,
    }
  }

  const totalPixels = before.width * before.height
  const unchanged: PageDiff = { status: 'unchanged', differingPixels: 0, totalPixels, ...sizes }
  if (Buffer.from(before.data).equals(Buffer.from(after.data))) return unchanged

  let decided: { count: number; out: Picture } | null = null
  for (const pass of PASSES) {
    const found = match(before, after, pass.colour * scale)
    const counts = found.count > 0 && found.count >= pass.floor(totalPixels) * scale
    if (counts && (decided === null || found.count > decided.count)) decided = found
  }
  if (decided === null) return unchanged
  return {
    status: 'changed',
    differingPixels: decided.count,
    totalPixels,
    ...sizes,
    highlight: decided.out,
  }
}

/** One page of the comparison, as the report lists it. */
export interface PageResult {
  id: string
  status: PageStatus
  differingPixels: number
  totalPixels: number
  before?: Size | undefined
  after?: Size | undefined
}

const ORDER: Record<PageStatus, number> = { changed: 0, added: 1, removed: 2, unchanged: 3 }

/**
 * Every page either side drew, classified, in the order a reviewer reads them: what changed,
 * then what is new, then what went, then the rest; by id within each.
 */
export function classifyPages(
  beforeIds: Iterable<string>,
  afterIds: Iterable<string>,
  diffOf: (id: string) => PageDiff,
): PageResult[] {
  const before = new Set(beforeIds)
  const after = new Set(afterIds)
  const results: PageResult[] = []
  for (const id of new Set([...before, ...after])) {
    if (!after.has(id)) results.push({ id, status: 'removed', differingPixels: 0, totalPixels: 0 })
    else if (!before.has(id))
      results.push({ id, status: 'added', differingPixels: 0, totalPixels: 0 })
    else {
      const diff = diffOf(id)
      results.push({
        id,
        status: diff.status,
        differingPixels: diff.differingPixels,
        totalPixels: diff.totalPixels,
        before: diff.before,
        after: diff.after,
      })
    }
  }
  return results.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.id.localeCompare(b.id))
}

/** How many pages fell in each class. */
export function countByStatus(results: readonly PageResult[]): Record<PageStatus, number> {
  const counts: Record<PageStatus, number> = { changed: 0, added: 0, removed: 0, unchanged: 0 }
  for (const result of results) counts[result.status]++
  return counts
}

/** Whether the comparison found anything a reviewer should look at. */
export function hasDifferences(results: readonly PageResult[]): boolean {
  return results.some((result) => result.status !== 'unchanged')
}
