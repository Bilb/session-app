/**
 * How many lines an account ID is broken across.
 *
 * Three, as the design draws it. Broken deliberately rather than left to wrap: an account ID is
 * 66 hex characters with nothing in it a line-breaker will break at, so on the web it runs
 * straight off both edges of its container, and a break at a character boundary would fall in a
 * different place at every font size.
 */
const LINES = 3

/**
 * An account ID, split into equal lines.
 *
 * Equal rather than filled: a person reading one out loud, or checking it against another screen,
 * is matching shapes -- and lines of the same length make a block whose middle line can be found
 * again after looking away.
 *
 * Anything that does not divide evenly puts the remainder on the last line, which is the only
 * place a short line does not disturb the block above it.
 */
export function accountIdLines(id: string): string[] {
  const per = Math.ceil(id.length / LINES)
  const lines: string[] = []
  for (let at = 0; at < id.length; at += per) lines.push(id.slice(at, at + per))
  return lines
}
