/**
 * The sent text while it is out, followed through each edit of the draft: null for good once the
 * draft stopped starting with it, since what follows is no longer the sent text plus more.
 */
export function followSent(sent: string | null, typed: string): string | null {
  return sent !== null && typed.startsWith(sent) ? sent : null
}

/**
 * What stays in the composer once `sent` went: whatever was typed after it while it was out, or
 * everything when the sent part was edited meanwhile (`sent` null), since that is not what went.
 */
export function draftAfterSend(typed: string, sent: string | null): string {
  if (sent === null || !typed.startsWith(sent)) return typed
  const rest = typed.slice(sent.length)
  return rest.trim() === '' ? '' : rest.trimStart()
}
