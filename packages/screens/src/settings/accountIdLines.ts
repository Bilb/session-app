/**
 * Where the desktop client breaks an account ID on its settings page: after the 27th character and
 * the 54th, leaving 12 on the last line.
 *
 * Broken deliberately rather than left to wrap: an ID is 66 hex characters with nothing in it a
 * line-breaker will break at, so on the web it runs off both edges of its container, and a break at
 * a character boundary would fall somewhere different at every size. Two long lines over a short
 * one read as a block with an ending, where three equal ones read as a grid. The two phone clients
 * leave theirs to wrap; this is the one that chose where.
 */
const BREAKS = [27, 54]

/** An account ID, broken where the desktop client breaks it. Nothing is lost or reordered. */
export function accountIdLines(id: string): string[] {
  const lines = [0, ...BREAKS].map((from, at) => id.slice(from, BREAKS[at]))
  return lines.filter((line) => line !== '')
}
