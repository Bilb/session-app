import { protocol } from 'electron'

import { isViewableContentType, mediaKindOf } from '@session/basic-types'
import type { Preview } from '@session/bridge-node'
import type { AttachmentRef } from '@session/client'

import { MEDIA_SCHEME, type MediaUrlKind } from '../shared/mediaUrl'
import { encodePng } from './png'

/**
 * Whatever can answer with an attachment's bytes: the addon, or the fake behind the same door.
 *
 * Narrower than the transport on purpose: serving the scheme has no business with frames.
 */
export interface MediaSource {
  fetchMedia(ref: AttachmentRef): Promise<{ contentType: string; bytes: Uint8Array }>
  fetchPreview(ref: AttachmentRef): Promise<Preview>
}

/**
 * Registered before `app.whenReady()`, which is the only time Electron accepts it.
 *
 * `standard` gives it a tuple origin and a parsed host rather than an opaque URL. A CSP can name
 * the scheme either way; the host parsing is why the ids sit in the path under a fixed word.
 * `secure` keeps it out of the mixed-content rules a page served over `file:` would otherwise
 * apply to it. Deliberately not `supportFetchAPI`, `corsEnabled` or `stream`: the renderer draws
 * these in an `<img>`, and anything script can call directly is more surface than that needs.
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true } },
  ])
}

// Number() alone would also take '', '0x2A', '1e1', '+42' and '-0'.
const ID_SEGMENT = /^(0|[1-9]\d{0,15})$/

function parseId(segment: string | undefined): number | null {
  if (segment === undefined || !ID_SEGMENT.test(segment)) return null
  const id = Number(segment)
  return Number.isSafeInteger(id) ? id : null
}

/** `session-media://<attachment|preview>/<messageId>/<index>` split back up, or null. */
export function parseMediaUrl(url: string): { kind: MediaUrlKind; ref: AttachmentRef } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${MEDIA_SCHEME}:`) return null
  if (parsed.search !== '' || parsed.hash !== '') return null
  const kind = parsed.hostname
  if (kind !== 'attachment' && kind !== 'preview') return null

  const [message, index, ...rest] = parsed.pathname.replace(/^\//, '').split('/')
  if (rest.length > 0) return null

  const messageId = parseId(message)
  const at = parseId(index)
  if (messageId === null || messageId === 0 || at === null) return null
  return { kind, ref: { messageId, index: at } }
}

/** Leading bytes of each format the scheme serves, as `[offset, bytes]` runs that must all match. */
const SIGNATURES: readonly (readonly [contentType: string, runs: readonly [number, string][]])[] = [
  ['image/png', [[0, '\x89PNG\r\n\x1a\n']]],
  ['image/jpeg', [[0, '\xff\xd8\xff']]],
  ['image/gif', [[0, 'GIF87a']]],
  ['image/gif', [[0, 'GIF89a']]],
  [
    'image/webp',
    [
      [0, 'RIFF'],
      [8, 'WEBP'],
    ],
  ],
  ['image/bmp', [[0, 'BM']]],
  ['video/mp4', [[4, 'ftyp']]],
  ['video/webm', [[0, '\x1a\x45\xdf\xa3']]],
  ['video/ogg', [[0, 'OggS']]],
]

function sniffContentType(bytes: Uint8Array): string | null {
  const match = SIGNATURES.find(([, runs]) =>
    runs.every(([at, run]) => [...run].every((c, i) => bytes[at + i] === c.charCodeAt(0))),
  )
  return match?.[0] ?? null
}

/**
 * The type to serve an attachment's bytes as, or null to refuse them.
 *
 * The sender declares the type, and an `<img>` decodes whatever format the bytes really are, so
 * the declaration alone decides nothing. Served only when it is on the viewable list and the bytes
 * are that family; the type returned is what the bytes are.
 */
export function servableContentType(declared: string, bytes: Uint8Array): string | null {
  if (!isViewableContentType(declared)) return null
  const sniffed = sniffContentType(bytes)
  if (sniffed === null || mediaKindOf(sniffed) !== mediaKindOf(declared)) return null
  return sniffed
}

function mediaHeaders(contentType: string): Record<string, string> {
  return {
    'content-type': contentType,
    // Keeps the bytes from ever being taken as a script or stylesheet; it does not gate what an
    // `<img>` decodes, which is what servableContentType is for.
    'x-content-type-options': 'nosniff',
    // Opened as a document rather than drawn, the response gets no script and no origin.
    'content-security-policy': "sandbox; default-src 'none'",
  }
}

/**
 * Serves the scheme from the bridge, in the main process, where the addon already is.
 *
 * Bytes never touch the frame stream and never cross as a message: Chromium fetches them for the
 * element that asked, decodes off the main thread, and caches the result itself. A transfer that
 * has to happen still reports progress as `attachment-progress` events, so the row draws the same
 * bar it would for a tap.
 */
export function serveMedia(bridge: MediaSource): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const target = parseMediaUrl(request.url)
    if (!target) return new Response(null, { status: 400 })

    try {
      if (target.kind === 'preview') {
        const preview = await bridge.fetchPreview(target.ref)
        return new Response(encodePng(preview.width, preview.height, preview.rgba), {
          status: 200,
          headers: mediaHeaders('image/png'),
        })
      }

      const media = await bridge.fetchMedia(target.ref)
      const contentType = servableContentType(media.contentType, media.bytes)
      if (contentType === null) return new Response(null, { status: 415 })
      return new Response(media.bytes, {
        status: 200,
        headers: mediaHeaders(contentType),
      })
    } catch {
      // Only a failure after a transfer started is on the frame stream too. A verdict, a missing
      // message or a failed preview is known from this status alone, so whoever draws the url
      // has to handle the image failing. Not stored, so the url is asked again after a retry.
      return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })
    }
  })
}

/** Called before the bridge closes, so nothing asks a closing bridge for bytes. */
export function stopServingMedia(): void {
  // A quit before the bridge opened never installed the handler.
  if (protocol.isProtocolHandled(MEDIA_SCHEME)) protocol.unhandle(MEDIA_SCHEME)
}
