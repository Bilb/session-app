/**
 * Where the country flow puts everything: pure geometry, so it can be tested and reused by the
 * drawing on both platforms.
 *
 * Five columns: you, the entry relay, two more relays, and the destination. Each column holds a bar
 * per country, as tall as the drawn paths that pass through that country at that column, and each
 * path takes a slot in each bar it passes through, so its line can be followed across.
 */

/** A path as the flow draws it: one country per column after "you", or null where unknown. */
export interface FlowPathInput {
  key: string
  countries: readonly (string | null)[]
}

export interface FlowBar {
  column: number
  /** The country code, `?` where unknown. */
  country: string
  /** How many drawn paths pass through it. */
  count: number
  y: number
  height: number
}

export interface FlowLayout {
  /** The drawing's width, which the last column's labels run up to. */
  width: number
  columnX: readonly number[]
  barWidth: number
  bars: FlowBar[]
  /** Each path's point in every column, "you" first. */
  points: ReadonlyMap<string, readonly (readonly [number, number])[]>
}

export const FLOW_COLUMNS = 5
const BAR_WIDTH = 5
const SIDE = 14
/** Below the column titles. */
const TOP = 40
const BOTTOM = 14
/** Room kept to the right of the last column for its labels. */
const RIGHT_LABELS = 66
/**
 * The most height one path is given in a bar, so a few paths sit together in the middle of the
 * drawing rather than each taking a third of the column.
 */
const MAX_UNIT = 12
const MAX_GAP = 10
const MIN_GAP = 2

/**
 * Countries by how many service nodes they hold, most first (measured November 2026). Every
 * column orders its bars by this rather than by its own counts, so a country sits at the same
 * height across the drawing and a line between two of them runs level. Others follow by code.
 */
const COUNTRY_RANK = [
  'DE', 'US', 'FI', 'GB', 'CA', 'FR', 'NL', 'SE', 'SG', 'PL', 'ZA', 'AU',
  'BG', 'JP', 'CZ', 'AE', 'IE', 'TH', 'IN', 'MY', 'KR', 'IT', 'RO', 'TR',
] // prettier-ignore

function rankOf(country: string): number {
  // The file server and unknown countries after every real one.
  if (country === 'FS') return 2_000
  if (country === '?') return 1_000
  const i = COUNTRY_RANK.indexOf(country)
  return i === -1 ? COUNTRY_RANK.length : i
}

function byRank(a: string, b: string): number {
  return rankOf(a) - rankOf(b) || (a < b ? -1 : a > b ? 1 : 0)
}

/** How tall the drawing is at a width: a band for a few paths, nearly square for many. */
export function pathFlowHeight(width: number, pathCount: number): number {
  return Math.round(width * (pathCount <= 6 ? 0.5 : 0.95))
}

export function layoutPathFlow(
  paths: readonly FlowPathInput[],
  width: number,
  height: number,
): FlowLayout {
  const step = Math.max(0, width - 2 * SIDE - BAR_WIDTH - RIGHT_LABELS) / (FLOW_COLUMNS - 1)
  const columnX = Array.from({ length: FLOW_COLUMNS }, (_, k) => SIDE + k * step)
  const avail = Math.max(1, height - TOP - BOTTOM)
  const points = new Map<string, Array<readonly [number, number]>>()
  for (const p of paths) points.set(p.key, [])

  const columns: [string, FlowPathInput[]][][] = []
  columns.push([['you', [...paths]]])
  for (let column = 1; column < FLOW_COLUMNS; column += 1) {
    const groups = new Map<string, FlowPathInput[]>()
    for (const p of paths) {
      const cc = p.countries[column - 1] ?? '?'
      const list = groups.get(cc)
      if (list) list.push(p)
      else groups.set(cc, [p])
    }
    columns.push([...groups.entries()].sort((a, b) => byRank(a[0], b[0])))
  }

  // Gaps shrink as countries multiply, so they never take the height the paths need.
  const mostBars = Math.max(...columns.map((c) => c.length))
  const gap = Math.max(MIN_GAP, Math.min(MAX_GAP, (avail * 0.3) / Math.max(1, mostBars - 1)))
  const unit =
    paths.length === 0
      ? 0
      : Math.min(
          MAX_UNIT,
          ...columns.map((c) => Math.max(0, avail - (c.length - 1) * gap) / paths.length),
        )

  const bars: FlowBar[] = []
  columns.forEach((groups, column) => {
    const columnHeight = paths.length * unit + (groups.length - 1) * gap
    let y = TOP + (avail - columnHeight) / 2
    for (const [country, members] of groups) {
      const h = members.length * unit
      bars.push({ column, country, count: members.length, y, height: h })
      // Within a bar, paths keep the order they had in the previous column, so lines cross less.
      const previous = (p: FlowPathInput) => points.get(p.key)?.[column - 1]?.[1] ?? 0
      const sorted = column === 0 ? members : [...members].sort((a, b) => previous(a) - previous(b))
      sorted.forEach((p, i) => {
        points.get(p.key)?.push([columnX[column] ?? 0, y + (i + 0.5) * unit])
      })
      y += h + gap
    }
  })
  return { width, columnX, barWidth: BAR_WIDTH, bars, points }
}

/** The cubic between two columns' points, which every line and packet follows. */
export function flowSegment(
  a: readonly [number, number],
  b: readonly [number, number],
  barWidth: number,
): [number, number, number, number, number, number, number, number] {
  const ax = a[0] + barWidth
  const mx = (ax + b[0]) / 2
  return [ax, a[1], mx, a[1], mx, b[1], b[0], b[1]]
}

/** A point on a path's line, `h` hops along it (0 at you, 4 at the destination). */
export function pointAlong(
  pts: readonly (readonly [number, number])[],
  h: number,
  barWidth: number,
): [number, number] {
  const last = pts.length - 1
  const clamped = Math.min(Math.max(h, 0), last)
  const i = Math.min(Math.floor(clamped), last - 1)
  const t = clamped - i
  const a = pts[i]
  const b = pts[i + 1]
  if (!a || !b) return [pts[0]?.[0] ?? 0, pts[0]?.[1] ?? 0]
  const [x0, y0, x1, y1, x2, y2, x3, y3] = flowSegment(a, b, barWidth)
  const u = 1 - t
  return [
    u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
    u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
  ]
}
