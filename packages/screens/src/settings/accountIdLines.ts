/**
 * Broken at 27 + 27 + 12: hex has no break opportunities, so left to wrap an ID
 * overflows its container on the web.
 */
const BREAKS = [27, 54]

/** An account ID in its three lines. Nothing is lost or reordered. */
export function accountIdLines(id: string): string[] {
  const lines = [0, ...BREAKS].map((from, at) => id.slice(from, BREAKS[at]))
  return lines.filter((line) => line !== '')
}
