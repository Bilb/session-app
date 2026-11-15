/**
 * Where the country flow puts everything: pure geometry, so it can be tested and reused by the
 * drawing on both platforms.
 *
 * Five columns: you, the entry relay, two more relays, and the destination. Each column holds a bar
 * per country, as tall as the share of drawn paths that pass through that country at that column,
 * and each path takes a slot in each bar it passes through, so its line can be followed across.
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
const BAR_WIDTH = 6
const GAP = 8
const TOP = 28
const BOTTOM = 8
/** Room kept to the right of the last column for its labels. */
const RIGHT_LABELS = 96
/**
 * The most height one path is given in a bar. A few paths would otherwise each take a third of
 * the column, and one would turn every bar into a rail from top to bottom; capped, they sit
 * together in the middle.
 */
const MAX_UNIT = 44

export function layoutPathFlow(
  paths: readonly FlowPathInput[],
  width: number,
  height: number,
): FlowLayout {
  const usable = Math.max(1, width - RIGHT_LABELS)
  const columnX = Array.from(
    { length: FLOW_COLUMNS },
    (_, k) => 8 + (k * (usable - 8 - BAR_WIDTH)) / (FLOW_COLUMNS - 1),
  )
  const avail = height - TOP - BOTTOM
  const bars: FlowBar[] = []
  const points = new Map<string, Array<readonly [number, number]>>()
  for (const p of paths) points.set(p.key, [])

  // "You": one bar holding every path.
  const youHeight = Math.min(avail, paths.length * MAX_UNIT)
  const youTop = TOP + (avail - youHeight) / 2
  bars.push({ column: 0, country: 'you', count: paths.length, y: youTop, height: youHeight })
  paths.forEach((p, i) =>
    points.get(p.key)?.push([columnX[0] ?? 0, youTop + (youHeight * (i + 0.5)) / paths.length]),
  )

  for (let column = 1; column < FLOW_COLUMNS; column += 1) {
    const groups = new Map<string, FlowPathInput[]>()
    for (const p of paths) {
      const cc = p.countries[column - 1] ?? '?'
      const list = groups.get(cc)
      if (list) list.push(p)
      else groups.set(cc, [p])
    }
    // Largest first, so the busiest countries sit at the top of every column.
    const ordered = [...groups.entries()].sort(
      (a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1),
    )
    const gaps = GAP * Math.max(0, ordered.length - 1)
    const unit =
      paths.length === 0 ? 0 : Math.min(MAX_UNIT, Math.max(0, avail - gaps) / paths.length)
    const used = ordered.reduce((sum, [, members]) => sum + Math.max(4, unit * members.length), 0)
    let y = TOP + Math.max(0, (avail - used - gaps) / 2)
    for (const [country, members] of ordered) {
      const h = Math.max(4, unit * members.length)
      bars.push({ column, country, count: members.length, y, height: h })
      // Within a bar, paths keep the order they had in the previous column, so lines cross less.
      const previous = (p: FlowPathInput) => points.get(p.key)?.[column - 1]?.[1] ?? 0
      const sorted = [...members].sort((a, b) => previous(a) - previous(b))
      sorted.forEach((p, i) => {
        points.get(p.key)?.push([columnX[column] ?? 0, y + (h * (i + 0.5)) / members.length])
      })
      y += h + GAP
    }
  }
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
