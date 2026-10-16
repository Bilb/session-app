/**
 * What stays in the composer once `sent` went: whatever was typed after it while it was out, or
 * everything when the sent part itself was edited, since that is no longer what went.
 */
export function draftAfterSend(typed: string, sent: string): string {
  if (!typed.startsWith(sent)) return typed
  const rest = typed.slice(sent.length)
  return rest.trim() === '' ? '' : rest.trimStart()
}
