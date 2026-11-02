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
 * change of colour across a large area; each is discarded when it finds too little, and of the two
 * that remain the one that finds more decides, the tolerant one on a tie. pixelmatch 7 measures
 * colour as odiff, which Argos runs, does: a YIQ distance under the same threshold.
 */
const PASSES = [
  { colour: 0.15, floor: (total: number) => Math.min(20, total * 0.0002) },
  { colour: 0.0225, floor: (total: number) => total * 0.03 },
] as const

export interface Size {
  width: number
  height: number
}

/** The verdict on a page drawn on both sides. */
export interface PageDiff {
  status: 'changed' | 'unchanged'
  /** Pixels counted as different by the pass that decided, 0 when unchanged. */
  differingPixels: number
  /** Pixels compared: the larger width by the larger height. */
  totalPixels: number
  before: Size
  after: Size
  /** The side scaled up to the canvas before comparing, and the size it was scaled to. */
  scaled?: Scaled | undefined
  /**
   * The `after` picture faded, on the canvas both were compared on: red where a pixel counts as
   * different, yellow where it differs only as anti-aliasing (not counted), and transparent where
   * `after` does not reach. Absent when unchanged.
   */
  highlight?: Picture | undefined
}

interface Scaled {
  side: 'before' | 'after'
  to: Size
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

const sameSize = (a: Size, b: Size) => a.width === b.width && a.height === b.height

/** sharp's default kernel, which Argos resizes with. */
const LANCZOS_LOBES = 3

function lanczos(x: number): number {
  if (x === 0) return 1
  if (Math.abs(x) >= LANCZOS_LOBES) return 0
  const px = Math.PI * x
  return (LANCZOS_LOBES * Math.sin(px) * Math.sin(px / LANCZOS_LOBES)) / (px * px)
}

/**
 * Each output sample's source samples and their weights along one axis, for an enlargement: pixel
 * centres aligned, edges extended.
 */
function kernelTaps(inLength: number, outLength: number): { at: Int32Array; weight: Float64Array } {
  const span = 2 * LANCZOS_LOBES
  const at = new Int32Array(outLength * span)
  const weight = new Float64Array(outLength * span)
  for (let out = 0; out < outLength; out++) {
    const centre = ((out + 0.5) * inLength) / outLength - 0.5
    const first = Math.floor(centre) - LANCZOS_LOBES + 1
    const weights = Array.from({ length: span }, (_, tap) => lanczos(centre - (first + tap)))
    const sum = weights.reduce((total, w) => total + w, 0)
    weights.forEach((w, tap) => {
      at[out * span + tap] = Math.min(inLength - 1, Math.max(0, first + tap))
      weight[out * span + tap] = w / sum
    })
  }
  return { at, weight }
}

/** `picture` resampled to `size`, larger in both dimensions, rows first and then columns. */
function enlarged(picture: Picture, size: Size): Picture {
  const span = 2 * LANCZOS_LOBES
  const across = kernelTaps(picture.width, size.width)
  const down = kernelTaps(picture.height, size.height)
  const wide = new Float32Array(size.width * picture.height * 4)
  for (let y = 0; y < picture.height; y++)
    for (let x = 0; x < size.width; x++)
      for (let channel = 0; channel < 4; channel++) {
        let value = 0
        for (let tap = 0; tap < span; tap++) {
          const from = across.at[x * span + tap] ?? 0
          value +=
            (across.weight[x * span + tap] ?? 0) *
            (picture.data[(y * picture.width + from) * 4 + channel] ?? 0)
        }
        wide[(y * size.width + x) * 4 + channel] = value
      }
  const data = new Uint8Array(size.width * size.height * 4)
  for (let y = 0; y < size.height; y++)
    for (let x = 0; x < size.width; x++)
      for (let channel = 0; channel < 4; channel++) {
        let value = 0
        for (let tap = 0; tap < span; tap++) {
          const from = down.at[y * span + tap] ?? 0
          value +=
            (down.weight[y * span + tap] ?? 0) * (wide[(from * size.width + x) * 4 + channel] ?? 0)
        }
        data[(y * size.width + x) * 4 + channel] = Math.min(255, Math.max(0, Math.round(value)))
      }
  return { ...size, data }
}

/**
 * The size sharp's `contain` resize gives `picture` in `canvas`: unchanged unless it is smaller in
 * both dimensions, when it is enlarged, keeping its aspect ratio, until one side fills the canvas.
 */
export function containedSize(picture: Size, canvas: Size): Size {
  const across = picture.width / canvas.width
  const down = picture.height / canvas.height
  if (across >= 1 || down >= 1) return { width: picture.width, height: picture.height }
  return across > down
    ? { width: canvas.width, height: Math.round(picture.height / across) }
    : { width: Math.round(picture.width / down), height: canvas.height }
}

/** `picture` at the top left of a `size` canvas, the rest transparent. */
function padded(picture: Picture, size: Size): Picture {
  if (sameSize(picture, size)) return picture
  const data = new Uint8Array(size.width * size.height * 4)
  for (let row = 0; row < picture.height; row++)
    data.set(
      picture.data.subarray(row * picture.width * 4, (row + 1) * picture.width * 4),
      row * size.width * 4,
    )
  return { ...size, data }
}

/** A picture as Argos compares it on `canvas`: enlarged as `containedSize` says, then padded. */
function onCanvas(picture: Picture, canvas: Size): Picture {
  const size = containedSize(picture, canvas)
  return padded(sameSize(size, picture) ? picture : enlarged(picture, size), canvas)
}

/**
 * Counts what differs. `after` goes first because pixelmatch draws the unchanged pixels from its
 * first picture; the count is the same either way round. odiff, which Argos runs, takes a
 * transparent pixel as white, and so does pixelmatch without its checkerboard.
 */
function match(after: Picture, before: Picture, colour: number): { count: number; out: Picture } {
  const out = { width: after.width, height: after.height, data: new Uint8Array(after.data.length) }
  const count = pixelmatch(after.data, before.data, out.data, after.width, after.height, {
    threshold: colour,
    includeAA: false,
    checkerboard: false,
  })
  // A pixel `after` does not cover stays see-through, so the report's backdrop shows its bounds.
  for (let at = 0; at < out.data.length; at += 4)
    if (after.data[at + 3] === 0 && out.data.subarray(at, at + 3).every((value) => value === 255))
      out.data[at + 3] = 0
  return { count, out }
}

/**
 * Compares a page's two pictures as Argos does. Pictures of different sizes go on a canvas the
 * larger width by the larger height, at its top left; one smaller in both dimensions is first
 * enlarged to fit, keeping its aspect ratio, and what neither covers is transparent. Both passes
 * then run on that canvas, so a change of size alone decides nothing: transparency counts only
 * where it lands on a pixel the other side drew in a colour other than white.
 */
export function diffPictures(
  before: Picture,
  after: Picture,
  sensitivity: number = ARGOS_SENSITIVITY,
): PageDiff {
  const scale = 2 * sensitivity
  const sizes = { before: sizeOf(before), after: sizeOf(after) }
  const canvas = {
    width: Math.max(before.width, after.width),
    height: Math.max(before.height, after.height),
  }
  const totalPixels = canvas.width * canvas.height
  const scaled = (['before', 'after'] as const)
    .map((side) => ({ side, to: containedSize(sizes[side], canvas) }))
    .find(({ side, to }) => !sameSize(to, sizes[side]))
  const verdict = { totalPixels, ...sizes, ...(scaled === undefined ? {} : { scaled }) }
  const unchanged: PageDiff = { status: 'unchanged', differingPixels: 0, ...verdict }

  const beforeOnCanvas = onCanvas(before, canvas)
  const afterOnCanvas = onCanvas(after, canvas)
  if (Buffer.from(beforeOnCanvas.data).equals(Buffer.from(afterOnCanvas.data))) return unchanged

  let decided: { count: number; out: Picture } | null = null
  for (const pass of PASSES) {
    const found = match(afterOnCanvas, beforeOnCanvas, pass.colour * scale)
    const counts = found.count > 0 && found.count >= pass.floor(totalPixels) * scale
    if (counts && (decided === null || found.count > decided.count)) decided = found
  }
  if (decided === null) return unchanged
  return { status: 'changed', differingPixels: decided.count, ...verdict, highlight: decided.out }
}

/** One page of the comparison, as the report lists it. */
export interface PageResult {
  id: string
  status: PageStatus
  differingPixels: number
  totalPixels: number
  before?: Size | undefined
  after?: Size | undefined
  scaled?: Scaled | undefined
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
        scaled: diff.scaled,
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
