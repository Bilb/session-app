// Imported by desktop main, the sandboxed renderer and mobile: no platform APIs.
// The subpath, not the barrel: desktop's build config loads this file through Node's own loader.
import { fromUtf8, isStagedPath, utf8Bytes } from '@session/basic-types/stagedPath'
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
 * One per image rather than a query parameter: the authority is the part the special-scheme host
 * parser already normalises, and it keeps the file and each image made of it at separate
 * URLs, which is what lets the platform cache them separately.
 */
export type MediaUrlKind = 'attachment' | 'thumbhash' | 'thumbnail' | 'rendition'

export function mediaUrl(kind: MediaUrlKind, { messageId, index }: AttachmentRef): string {
  return `${MEDIA_SCHEME}://${kind}/${String(messageId)}/${String(index)}`
}

// The canonical form only, as the shim's `parse_media_url` reads it: Chromium hands a handler the
// canonicalised URL, and a native loader is handed the one the app built.
const MEDIA_URL = new RegExp(
  `^${MEDIA_SCHEME}://(?<kind>attachment|thumbhash|thumbnail|rendition)/(?<message>0|[1-9]\\d{0,15})/(?<index>0|[1-9]\\d{0,15})$`,
)

const UNRESERVED = /^[A-Za-z0-9._~-]$/

function encodeStaged(path: string): string | null {
  const bytes = utf8Bytes(path)
  if (bytes === null) return null
  return bytes
    .map((byte) => {
      const char = String.fromCharCode(byte)
      return UNRESERVED.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
    })
    .join('')
}

/**
 * The thumbnail of a file chosen to send, which no message holds yet:
 * `session-media://staged/<path>`, the path as one segment with every byte outside the unreserved
 * set escaped in uppercase hex, the form Chromium already hands a handler. Null for a path the
 * shim would refuse.
 */
export function stagedThumbnailUrl(path: string): string | null {
  if (!isStagedPath(path)) return null
  const segment = encodeStaged(path)
  return segment === null ? null : `${MEDIA_SCHEME}://staged/${segment}`
}

const STAGED_URL = new RegExp(`^${MEDIA_SCHEME}://staged/(?<segment>[A-Za-z0-9._~%-]+)$`)

/** The path back out of a staged url, or null unless the url is exactly what the builder makes. */
function parseStaged(url: string): string | null {
  const segment = STAGED_URL.exec(url)?.groups?.['segment']
  if (segment === undefined) return null
  const bytes: number[] = []
  for (let i = 0; i < segment.length;) {
    if (segment[i] === '%') {
      const hex = segment.slice(i + 1, i + 3)
      if (!/^[0-9A-F]{2}$/.test(hex)) return null
      bytes.push(parseInt(hex, 16))
      i += 3
    } else {
      bytes.push(segment.charCodeAt(i))
      i += 1
    }
  }
  const path = fromUtf8(bytes)
  // Re-encoding refuses every other spelling of the same path, so one path has one url.
  if (path === null || !isStagedPath(path) || encodeStaged(path) !== segment) return null
  return path
}

interface ParsedAttachmentUrl {
  kind: MediaUrlKind
  ref: AttachmentRef
}

interface ParsedStagedUrl {
  kind: 'staged'
  path: string
}

/**
 * `session-media://<attachment|thumbhash|thumbnail|rendition>/<messageId>/<index>` or
 * `session-media://staged/<path>` split back up, or null.
 */
export function parseMediaUrl(url: string): ParsedAttachmentUrl | ParsedStagedUrl | null {
  const staged = parseStaged(url)
  if (staged !== null) return { kind: 'staged', path: staged }
  const groups = MEDIA_URL.exec(url)?.groups as
    { kind: MediaUrlKind; message: string; index: string } | undefined
  if (groups === undefined) return null
  const messageId = Number(groups.message)
  const index = Number(groups.index)
  // A rowid, so zero names nothing. Past 2^53 - 1, Number() rounds rather than refusing.
  if (messageId === 0 || !Number.isSafeInteger(messageId) || !Number.isSafeInteger(index)) {
    return null
  }
  return { kind: groups.kind, ref: { messageId, index } }
}
