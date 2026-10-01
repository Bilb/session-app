// Imported by both main and the sandboxed renderer: no electron, no DOM, no node builtins.
import type { AttachmentRef } from '@session/client'

/**
 * The scheme an attachment's bytes reach the renderer by.
 *
 * `session-media://attachment/<messageId>/<index>`. A registered scheme rather than `file:`
 * because the point is that the renderer gets exactly this one door: it cannot name a path, only
 * a message and a position in it, and what comes back is whatever libsession decrypted for it.
 *
 * The ids are both in the path and the authority is a fixed word, because a standard scheme gets
 * the special-scheme host parser: `session-media://5/0` canonicalises to the host `0.0.0.5`.
 */
export const MEDIA_SCHEME = 'session-media'

/**
 * The authority, so that no part of the ref is parsed as a host name.
 *
 * Two of them rather than a query parameter: the authority is the part the special-scheme host
 * parser already normalises, and it keeps the file and its placeholder at separate URLs, which is
 * what lets the platform cache them separately.
 */
export type MediaUrlKind = 'attachment' | 'preview'

export function mediaUrl(kind: MediaUrlKind, { messageId, index }: AttachmentRef): string {
  return `${MEDIA_SCHEME}://${kind}/${String(messageId)}/${String(index)}`
}
