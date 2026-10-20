import { readFileSync, writeFileSync } from 'node:fs'

/**
 * The zoom levels View → Zoom In and Zoom Out step through: the browser's own, from half size to
 * twice. Steps rather than a fixed increment, because the useful levels bunch up near 100%. The
 * range is the current desktop client's, which offers 50% to 200%.
 */
export const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const

/** One step in or out, or back to the default. */
export type ZoomStep = 'in' | 'out' | 'reset'

/** The level one step from `current`, which is one of `ZOOM_LEVELS` (see `readZoom`). */
export function steppedZoom(current: number, step: ZoomStep): number {
  if (step === 'reset') return 1
  const at = ZOOM_LEVELS.findIndex((level) => level === current)
  const from = at === -1 ? ZOOM_LEVELS.indexOf(1) : at
  const next = Math.min(Math.max(from + (step === 'in' ? 1 : -1), 0), ZOOM_LEVELS.length - 1)
  return ZOOM_LEVELS[next] ?? 1
}

/** The saved zoom, or the default when there is none or it is not a level this build offers. */
export function readZoom(path: string): number {
  try {
    const saved: unknown = JSON.parse(readFileSync(path, 'utf8'))
    const zoom =
      typeof saved === 'object' && saved !== null && 'zoom' in saved ? saved.zoom : undefined
    return ZOOM_LEVELS.find((level) => level === zoom) ?? 1
  } catch {
    return 1
  }
}

/** Best effort: a zoom that could not be saved comes back at the default next launch. */
export function writeZoom(path: string, zoom: number): void {
  try {
    writeFileSync(path, JSON.stringify({ zoom }))
  } catch {
    // Nothing to tell anybody, and nothing else depends on it.
  }
}
