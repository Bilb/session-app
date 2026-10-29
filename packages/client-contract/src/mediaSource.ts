/**
 * What every media source must do: the addon, the Nitro bridge and the fake answer a media URL
 * through it, so a picture drawn on the fake predicts one drawn on libsession. Only the fake can
 * download an incoming attachment offline, so only the fake runs the scenarios that need one.
 *
 * A source answers from libsession's cache only: nothing drawn on screen may spend data, so the
 * one way bytes arrive is a download somebody asked for.
 */

import { jpegSize } from '@session/basic-types'
import type { Attachment, AttachmentRef, MediaSource, SessionClient } from '@session/client'

import type { TestFns } from './suite'

export interface MediaSourceHarness {
  /**
   * A source over a client holding two incoming pictures, an AVIF, a PDF and a picture sent as the
   * original file, none fetched: one picture sent with a hash, in a type other than the JPEG every
   * dev photograph is, and one sent without. The hashed picture's downloaded bytes are a JPEG, so
   * its thumbnail can be held to its shape.
   */
  withAttachments(): Promise<{
    source: MediaSource
    client: SessionClient
    conversationId: string
    picture: AttachmentRef
    unhashed: AttachmentRef
    document: AttachmentRef
    /** libsession thumbnails an AVIF, though no viewer here opens one. */
    avif: AttachmentRef
    /** A PNG its sender sent as the original file, which is only ever exported. */
    original: AttachmentRef
    /** Lets whatever is in flight finish: a manual clock, or a real transfer. */
    settle: () => Promise<void>
  }>
  /** A source over a client with no messages at all. */
  empty(): Promise<{ source: MediaSource }>
  /**
   * A source over a client with no messages, and the absolute paths of files staged to send: a
   * JPEG neither square nor within the largest thumbnail edge, `jpegSizePx` in size, a PNG, a PDF,
   * one not there, and a JPEG larger than `MAX_STAGED_READ_BYTES`.
   * `notRegular` are there but not regular files: a directory, and where the platform has them, a
   * FIFO nobody writes to and a link to a device, any of which would block a reader that waited.
   */
  staged(): Promise<{
    source: MediaSource
    client: SessionClient
    jpeg: string
    jpegSizePx: PixelSize
    png: string
    document: string
    missing: string
    oversized: string
    notRegular: readonly string[]
  }>
}

interface PixelSize {
  width: number
  height: number
}

/**
 * Whether a thumbnail keeps `source`'s shape: `source` scaled to the thumbnail's longer side, give
 * or take the pixel a resize rounds by. Only for a source within 21:9, which libsession crops to.
 */
function keepsShape(thumbnail: PixelSize | null, source: PixelSize | null): boolean {
  if (thumbnail === null || source === null || thumbnail.width === 0) return false
  const scale =
    thumbnail.width >= thumbnail.height
      ? thumbnail.width / source.width
      : thumbnail.height / source.height
  return (
    Math.abs(source.width * scale - thumbnail.width) <= 1 &&
    Math.abs(source.height * scale - thumbnail.height) <= 1
  )
}

/** Whether a thumbnail is no taller than the client's thumbnail edge, which is its height. */
function withinEdge(thumbnail: PixelSize | null, edgePx: number): boolean {
  return thumbnail !== null && thumbnail.height <= edgePx
}

async function failure(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call()
    return undefined
  } catch (error) {
    return error
  }
}

const NOWHERE: AttachmentRef = { messageId: 987_654_321, index: 0 }

/** What every source says of a ref that names nothing, the file and its thumbhash alike. */
function unknownRefMessage({ messageId, index }: AttachmentRef): string {
  return `attachment ${String(index)} of message ${String(messageId)} does not exist`
}

/** What every source says of an attachment that exists but was sent with no hash. */
function noThumbhashMessage({ messageId, index }: AttachmentRef): string {
  return `attachment ${String(index)} of message ${String(messageId)} has no thumbhash`
}

/** What every source says of an attachment whose file is not cached. */
function notDownloadedMessage({ messageId, index }: AttachmentRef): string {
  return `attachment ${String(index)} of message ${String(messageId)} is not downloaded`
}

/** What every source says of an attachment libsession holds no thumbnail of. */
function noThumbnailMessage({ messageId, index }: AttachmentRef): string {
  return `attachment ${String(index)} of message ${String(messageId)} has no thumbnail`
}

/** What every source says of an attachment libsession holds no rendition of. */
function noRenditionMessage({ messageId, index }: AttachmentRef): string {
  return `attachment ${String(index)} of message ${String(messageId)} has no rendition`
}

/** The box libsession fits a rendition in when no edge has been set. */
const RENDITION_EDGE_PX = 2048

/** libsession makes a thumbnail, then a rendition, after the bytes are cached, on a worker. */
async function until(
  made: 'hasThumbnail' | 'hasRendition',
  client: SessionClient,
  conversationId: string,
  ref: AttachmentRef,
  settle: () => Promise<void>,
): Promise<Attachment | undefined> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await settle()
    const attachment = await attachmentOf(client, conversationId, ref)
    if (attachment?.[made] === true) return attachment
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return attachmentOf(client, conversationId, ref)
}

function untilThumbnailed(
  client: SessionClient,
  conversationId: string,
  ref: AttachmentRef,
  settle: () => Promise<void>,
): Promise<Attachment | undefined> {
  return until('hasThumbnail', client, conversationId, ref, settle)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function attachmentOf(
  client: SessionClient,
  conversationId: string,
  { messageId, index }: AttachmentRef,
): Promise<Attachment | undefined> {
  const page = await client.getMessages(conversationId, { limit: 50 })
  return page.messages.find((m) => m.id === messageId)?.attachments.find((a) => a.index === index)
}

export function runMediaSourceContract(
  harness: MediaSourceHarness,
  t: TestFns,
  { unsupported = {} }: { unsupported?: Record<string, string> } = {},
): void {
  const { describe, expect } = t

  function it(name: string, body: () => Promise<void>): void {
    const reason = unsupported[name]
    if (reason === undefined) t.it(name, body)
    else t.it.skip(`${name} - ${reason}`, body)
  }

  describe('media source', () => {
    it('refuses a ref that names nothing, for the file and every image made of it', async () => {
      const { source } = await harness.empty()
      const refusals = [
        await failure(() => source.fetchMedia(NOWHERE)),
        await failure(() => source.fetchThumbhash(NOWHERE)),
        await failure(() => source.fetchThumbnail(NOWHERE)),
        await failure(() => source.fetchRendition(NOWHERE)),
      ]
      // One fact, however it is asked for: the thumbhash says no more and no less than the file.
      for (const refusal of refusals) {
        expect(refusal instanceof Error).toBe(true)
        expect(messageOf(refusal)).toBe(unknownRefMessage(NOWHERE))
      }
    })

    it('answers a downloaded picture with its bytes and the type they were sent as', async () => {
      const { source, client, conversationId, picture, settle } = await harness.withAttachments()
      const downloaded = client.downloadAttachment(picture.messageId, picture.index)
      await settle()
      await downloaded
      const media = await source.fetchMedia(picture)
      expect(media.bytes instanceof Uint8Array).toBe(true)
      expect(media.bytes.length).toBeGreaterThan(0)
      const declared = (await attachmentOf(client, conversationId, picture))?.contentType
      expect(declared?.startsWith('image/')).toBe(true)
      expect(media.contentType).toBe(declared)
    })

    it('refuses a picture that is not downloaded, and starts no transfer', async () => {
      const { source, client, conversationId, picture, settle } = await harness.withAttachments()
      // As it was, whatever that is: the addon's forged pointers carry no url and read unreadable.
      const before = (await attachmentOf(client, conversationId, picture))?.availability
      const reports: unknown[] = []
      const stop = client.onEvent((event) => {
        if (event.type === 'attachment-progress') reports.push(event)
      })
      const refused = await failure(() => source.fetchMedia(picture))
      await settle()
      stop()
      expect(messageOf(refused)).toBe(notDownloadedMessage(picture))
      expect(reports).toEqual([])
      expect(before === 'cached').toBe(false)
      expect((await attachmentOf(client, conversationId, picture))?.availability).toBe(before)
    })

    it('answers a thumbhash as width * height RGBA pixels where the sender sent a hash', async () => {
      const { source, picture } = await harness.withAttachments()
      const thumbhash = await source.fetchThumbhash(picture)
      expect(thumbhash.width).toBeGreaterThan(0)
      expect(thumbhash.height).toBeGreaterThan(0)
      expect(thumbhash.rgba.length).toBe(thumbhash.width * thumbhash.height * 4)
    })

    it('has no thumbhash where the sender sent no hash', async () => {
      const { source, unhashed } = await harness.withAttachments()
      // Exactly this sentence, so a ref that misses the attachment cannot pass on the unknown-ref
      // refusal.
      expect(messageOf(await failure(() => source.fetchThumbhash(unhashed)))).toBe(
        noThumbhashMessage(unhashed),
      )
    })

    it('answers a downloaded picture with a JPEG thumbnail of its shape, within the edge, at the size the attachment gives', async () => {
      const { source, client, conversationId, picture, settle } = await harness.withAttachments()
      const downloaded = client.downloadAttachment(picture.messageId, picture.index)
      await settle()
      await downloaded
      const attachment = await untilThumbnailed(client, conversationId, picture, settle)
      expect(attachment?.hasThumbnail).toBe(true)

      const size = jpegSize(await source.fetchThumbnail(picture))
      const original = jpegSize((await source.fetchMedia(picture)).bytes)
      expect(keepsShape(size, original)).toBe(true)
      expect(withinEdge(size, await client.getThumbnailEdge())).toBe(true)
      expect(size).toEqual({
        width: attachment?.thumbnailWidthPx,
        height: attachment?.thumbnailHeightPx,
      })
    })

    it('answers a downloaded AVIF with a JPEG thumbnail, though no viewer here opens one', async () => {
      const { source, client, conversationId, avif, settle } = await harness.withAttachments()
      const downloaded = client.downloadAttachment(avif.messageId, avif.index)
      await settle()
      await downloaded
      expect((await untilThumbnailed(client, conversationId, avif, settle))?.hasThumbnail).toBe(
        true,
      )

      const size = jpegSize(await source.fetchThumbnail(avif))
      expect(size?.width).toBeGreaterThan(0)
      expect(size?.height).toBeGreaterThan(0)
    })

    it('has no thumbnail of a picture not yet downloaded', async () => {
      const { source, client, conversationId, picture } = await harness.withAttachments()
      expect((await attachmentOf(client, conversationId, picture))?.hasThumbnail).toBe(false)
      expect(messageOf(await failure(() => source.fetchThumbnail(picture)))).toBe(
        noThumbnailMessage(picture),
      )
    })

    it('makes a rendition of a downloaded picture once asked, a JPEG or WebP within the edge', async () => {
      const { source, client, conversationId, picture, settle } = await harness.withAttachments()
      const downloaded = client.downloadAttachment(picture.messageId, picture.index)
      await settle()
      await downloaded
      await untilThumbnailed(client, conversationId, picture, settle)
      // None until a viewer asks: the first fetch is refused, and is the ask.
      expect((await attachmentOf(client, conversationId, picture))?.hasRendition).toBe(false)
      expect(messageOf(await failure(() => source.fetchRendition(picture)))).toBe(
        noRenditionMessage(picture),
      )
      expect(
        (await until('hasRendition', client, conversationId, picture, settle))?.hasRendition,
      ).toBe(true)

      const rendition = await source.fetchRendition(picture)
      expect(['image/jpeg', 'image/webp']).toContain(rendition.contentType)
      if (rendition.contentType === 'image/jpeg') {
        const size = jpegSize(rendition.bytes)
        expect(size?.width).toBeGreaterThan(0)
        const longest = Math.max(size?.width ?? Infinity, size?.height ?? Infinity)
        expect(longest <= RENDITION_EDGE_PX).toBe(true)
      } else {
        expect(String.fromCharCode(...rendition.bytes.subarray(8, 12))).toBe('WEBP')
      }
    })

    it('has no rendition of a picture not yet downloaded', async () => {
      const { source, client, conversationId, picture } = await harness.withAttachments()
      expect((await attachmentOf(client, conversationId, picture))?.hasRendition).toBe(false)
      expect(messageOf(await failure(() => source.fetchRendition(picture)))).toBe(
        noRenditionMessage(picture),
      )
    })

    it('marks a picture its sender sent as the original file', async () => {
      const { client, conversationId, picture, original } = await harness.withAttachments()
      expect((await attachmentOf(client, conversationId, original))?.originalFile).toBe(true)
      expect((await attachmentOf(client, conversationId, picture))?.originalFile).toBe(false)
    })

    it('thumbnails a downloaded original file but makes no rendition of it', async () => {
      const { source, client, conversationId, original, settle } = await harness.withAttachments()
      const downloaded = client.downloadAttachment(original.messageId, original.index)
      await settle()
      await downloaded
      const attachment = await untilThumbnailed(client, conversationId, original, settle)
      expect(attachment?.hasThumbnail).toBe(true)
      expect(attachment?.hasRendition).toBe(false)
      expect(messageOf(await failure(() => source.fetchRendition(original)))).toBe(
        noRenditionMessage(original),
      )
    })

    it('answers a staged picture with a JPEG thumbnail of its shape, within the edge', async () => {
      const { source, client, jpeg, jpegSizePx } = await harness.staged()
      const size = jpegSize(await source.fetchStagedThumbnail(jpeg))
      expect(keepsShape(size, jpegSizePx)).toBe(true)
      expect(withinEdge(size, await client.getThumbnailEdge())).toBe(true)
    })

    it('answers a staged PNG with a JPEG thumbnail', async () => {
      const { source, png } = await harness.staged()
      expect(jpegSize(await source.fetchStagedThumbnail(png))?.width).toBeGreaterThan(0)
    })

    it('refuses a staged file that is not a picture, or is not there', async () => {
      const { source, document, missing } = await harness.staged()
      expect(messageOf(await failure(() => source.fetchStagedThumbnail(document)))).toBe(
        'the file is not a picture',
      )
      expect(messageOf(await failure(() => source.fetchStagedThumbnail(missing)))).toBe(
        'the file could not be read',
      )
    })

    it('refuses a staged file larger than any it reads', async () => {
      const { source, oversized } = await harness.staged()
      expect(messageOf(await failure(() => source.fetchStagedThumbnail(oversized)))).toBe(
        'the file could not be read',
      )
    })

    it('refuses what is there but is not a regular file, without waiting on it', async () => {
      const { source, notRegular } = await harness.staged()
      expect(notRegular.length).toBeGreaterThan(0)
      for (const path of notRegular) {
        expect(messageOf(await failure(() => source.fetchStagedThumbnail(path)))).toBe(
          'the file could not be read',
        )
      }
    })

    it('refuses a staged path that is relative, climbs out or reaches across a network', async () => {
      const { source, jpeg } = await harness.staged()
      for (const path of [
        'photo.jpg',
        `${jpeg}/../photo.jpg`,
        '//host/share/photo.jpg',
        '\\\\host\\share\\photo.jpg',
        '/\\host\\share\\photo.jpg',
        `${jpeg}\0`,
        '',
      ]) {
        expect(messageOf(await failure(() => source.fetchStagedThumbnail(path)))).toBe(
          'not an absolute path',
        )
      }
    })

    it('has no thumbnail or rendition of a downloaded PDF', async () => {
      const { source, client, conversationId, document, settle } = await harness.withAttachments()
      const downloaded = client.downloadAttachment(document.messageId, document.index)
      await settle()
      await downloaded
      const attachment = await attachmentOf(client, conversationId, document)
      expect(attachment?.availability).toBe('cached')
      expect(attachment?.hasThumbnail).toBe(false)
      expect(attachment?.hasRendition).toBe(false)
      expect(messageOf(await failure(() => source.fetchThumbnail(document)))).toBe(
        noThumbnailMessage(document),
      )
      expect(messageOf(await failure(() => source.fetchRendition(document)))).toBe(
        noRenditionMessage(document),
      )
    })
  })
}
