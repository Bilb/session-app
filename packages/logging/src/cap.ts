/**
 * The most of one message or field the sweep is given.
 *
 * The sweep's cost grows with the text, and nothing written for a person runs this long: what does
 * is a dump of bytes, which a log is no worse for losing the end of.
 */
export const MAX_SWEPT_CHARS = 4096

/**
 * `text` cut to `max` characters, ready to be swept.
 *
 * Cut **before** the sweep, since the sweep is the cost, which means the cut can land inside a key:
 * the half left behind could be shorter than anything the sweep recognises -- 31 hex digits of a
 * key, written in the clear. So when the cut falls inside a run of non-space characters, the whole
 * run goes, and the note at the end says how much did.
 */
export function capForSweep(text: string, max: number = MAX_SWEPT_CHARS): string {
  if (text.length <= max) return text
  let kept = text.slice(0, max)
  if (!/\s/.test(text.charAt(max))) kept = kept.replace(/\S+$/, '')
  kept = kept.trimEnd()
  const note = `[cut ${String(text.length - kept.length)} chars]`
  return kept === '' ? note : `${kept} ${note}`
}
