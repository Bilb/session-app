/**
 * What every media source must do: the addon, the Nitro bridge and the fake answer a media URL
 * through it, so a picture drawn on the fake predicts one drawn on libsession.
 */

import type { AttachmentRef, MediaSource, SessionClient } from '@session/client'

import type { TestFns } from './suite'

export interface MediaSourceHarness {
  /**
   * A source over a client holding one incoming message with a picture that carries a hash and a
   * file that does not, neither of them fetched.
   */
  withAttachments(): Promise<{
    source: MediaSource
    client: SessionClient
    conversationId: string
    picture: AttachmentRef
    unhashed: AttachmentRef
    /** Lets whatever is in flight finish: a manual clock, or a real transfer. */
    settle: () => Promise<void>
  }>
  /** A source over a client with no messages at all. */
  empty(): Promise<{ source: MediaSource }>
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
    it('refuses a ref that names nothing, for the file and for its preview', async () => {
      const { source } = await harness.empty()
      expect(await failure(() => source.fetchMedia(NOWHERE))).toBeDefined()
      expect(await failure(() => source.fetchPreview(NOWHERE))).toBeDefined()
    })

    it('answers a picture with its bytes and the type they were sent as', async () => {
      const { source, picture, settle } = await harness.withAttachments()
      const answer = source.fetchMedia(picture)
      await settle()
      const media = await answer
      expect(media.bytes instanceof Uint8Array).toBe(true)
      expect(media.bytes.length).toBeGreaterThan(0)
      expect(media.contentType.startsWith('image/')).toBe(true)
    })

    it('reports a picture as cached once its bytes have been served', async () => {
      const { source, client, conversationId, picture, settle } = await harness.withAttachments()
      const answer = source.fetchMedia(picture)
      await settle()
      await answer
      const page = await client.getMessages(conversationId, { limit: 50 })
      const attachment = page.messages
        .find((m) => m.id === picture.messageId)
        ?.attachments.find((a) => a.index === picture.index)
      expect(attachment?.availability).toBe('cached')
    })

    it('answers a preview as width * height RGBA pixels where the sender sent a hash', async () => {
      const { source, picture } = await harness.withAttachments()
      const preview = await source.fetchPreview(picture)
      expect(preview.width).toBeGreaterThan(0)
      expect(preview.height).toBeGreaterThan(0)
      expect(preview.rgba.length).toBe(preview.width * preview.height * 4)
    })

    it('has no preview where the sender sent no hash', async () => {
      const { source, unhashed } = await harness.withAttachments()
      expect(await failure(() => source.fetchPreview(unhashed))).toBeDefined()
    })
  })
}
