import { protocol } from 'electron'

import { isViewableContentType, mediaKindOf, sniffContentType } from '@session/basic-types'
import type { MediaSource } from '@session/client'

import { MEDIA_SCHEME, parseMediaUrl } from '@session/app/mediaUrl'
import { encodePng } from './png'
import type { PreviewGrants } from './previewGrants'

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
 * element that asked, decodes off the main thread, and caches the result itself. Every attachment
 * kind is served from libsession's cache only, so drawing a URL never downloads anything; a staged
 * file only once the preload has granted it.
 */
export function serveMedia(bridge: MediaSource, previews: PreviewGrants): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    if (previews.names(request.url)) {
      const path = previews.pathFor(request.url)
      if (path === null) return new Response(null, { status: 403 })
      try {
        const jpeg = await bridge.fetchStagedThumbnail(path)
        if (servableContentType('image/jpeg', jpeg) !== 'image/jpeg') {
          return new Response(null, { status: 415 })
        }
        return new Response(jpeg, { status: 200, headers: mediaHeaders('image/jpeg') })
      } catch {
        return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })
      }
    }

    const target = parseMediaUrl(request.url)
    if (!target) return new Response(null, { status: 400 })
    // A path the page names itself is never opened here: a picked file is drawn by its grant.
    if (target.kind === 'staged') return new Response(null, { status: 403 })

    try {
      if (target.kind === 'thumbhash') {
        const thumbhash = await bridge.fetchThumbhash(target.ref)
        return new Response(encodePng(thumbhash.width, thumbhash.height, thumbhash.rgba), {
          status: 200,
          headers: mediaHeaders('image/png'),
        })
      }

      if (target.kind === 'thumbnail') {
        const jpeg = await bridge.fetchThumbnail(target.ref)
        if (servableContentType('image/jpeg', jpeg) !== 'image/jpeg') {
          return new Response(null, { status: 415 })
        }
        return new Response(jpeg, { status: 200, headers: mediaHeaders('image/jpeg') })
      }

      const media =
        target.kind === 'rendition'
          ? await bridge.fetchRendition(target.ref)
          : await bridge.fetchMedia(target.ref)
      const contentType = servableContentType(media.contentType, media.bytes)
      if (contentType === null) return new Response(null, { status: 415 })
      return new Response(media.bytes, {
        status: 200,
        headers: mediaHeaders(contentType),
      })
    } catch {
      // A file not downloaded, a missing message, a failed thumbhash or a missing derived image is
      // known from this status alone, so whoever draws the url has to handle the image failing.
      // Not stored, so the url is asked again once the file is here.
      // TODO: serve a sender's own attachment from its local copy while it uploads; libsession
      // refuses a file not uploaded yet, so that picture is a 404 here.
      return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })
    }
  })
}

/** Called before the bridge closes, so nothing asks a closing bridge for bytes. */
export function stopServingMedia(): void {
  // A quit before the bridge opened never installed the handler.
  if (protocol.isProtocolHandled(MEDIA_SCHEME)) protocol.unhandle(MEDIA_SCHEME)
}
