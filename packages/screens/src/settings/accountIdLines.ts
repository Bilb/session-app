/**
 * The desktop client's breaks, 27 + 27 + 12. Hex has no break opportunities, so left to wrap an ID
 * overflows its container on the web.
 */
const BREAKS = [27, 54]

/** An account ID, broken where the desktop client breaks it. Nothing is lost or reordered. */
export function accountIdLines(id: string): string[] {
  const lines = [0, ...BREAKS].map((from, at) => id.slice(from, BREAKS[at]))
  return lines.filter((line) => line !== '')
}
