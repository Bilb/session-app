import { SERVABLE_VECTORS } from '@session/client-contract'
import type { AttachmentMedia, DecodePlan, DecodePlanner, MediaSource } from '@session/client'
import { describe, expect, it, vi } from 'vitest'

import { mediaResponse, servableContentType } from '#src/main/media'
import { PreviewGrants } from '#src/main/previewGrants'

/** The shim's `servable_content_type` answers the same vectors in bridge-node's tests. */
describe('what the media scheme will serve', () => {
  it('serves and refuses what every servable check does', () => {
    for (const { declared, bytes, served } of SERVABLE_VECTORS) {
      expect(servableContentType(declared, bytes), `${declared} ${String(bytes.length)}`).toBe(
        served,
      )
    }
  })
})

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0, 0, 0])
const WEBP = Uint8Array.from('RIFF\x24\0\0\0WEBPVP8 ', (c) => c.charCodeAt(0))
const GIF = Uint8Array.from('GIF89a\0\0\0\0\0\0\0\0\0\0', (c) => c.charCodeAt(0))
const MP4 = Uint8Array.from('\0\0\0\x18ftypmp42\0\0\0\0', (c) => c.charCodeAt(0))

const WHOLE: DecodePlan = { edge: 0, firstFrameOnly: false, refused: false, measured: true }
const REDUCED: DecodePlan = { ...WHOLE, edge: 2896 }

function bridgeServing(
  original: AttachmentMedia,
  plan: DecodePlan,
  rendition: AttachmentMedia | null,
): { bridge: MediaSource & DecodePlanner; planDecode: ReturnType<typeof vi.fn> } {
  const refuse = () => Promise.reject(new Error('has no rendition'))
  const planDecode = vi.fn(() => plan)
  const bridge = {
    fetchMedia: () => Promise.resolve(original),
    fetchRendition: () => (rendition === null ? refuse() : Promise.resolve(rendition)),
    fetchThumbnail: () => Promise.resolve(JPEG),
    fetchThumbhash: () => Promise.reject(new Error('unused')),
    fetchStagedThumbnail: () => Promise.reject(new Error('unused')),
    planDecode,
  }
  return { bridge, planDecode }
}

async function served(bridge: MediaSource & DecodePlanner, url: string) {
  const response = await mediaResponse(bridge, new PreviewGrants(), url)
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    cache: response.headers.get('cache-control'),
    bytes: new Uint8Array(await response.arrayBuffer()),
  }
}

const ORIGINAL = 'session-media://attachment/4/0'

describe('an original Chromium is handed', () => {
  it('is served as it is within the budget', async () => {
    const { bridge, planDecode } = bridgeServing(
      { contentType: 'image/jpeg', bytes: JPEG },
      WHOLE,
      null,
    )
    expect(await served(bridge, ORIGINAL)).toMatchObject({
      status: 200,
      type: 'image/jpeg',
      bytes: JPEG,
    })
    expect(planDecode).toHaveBeenCalledWith(JPEG)
  })

  it("is libsession's rendition past the budget", async () => {
    const { bridge } = bridgeServing({ contentType: 'image/jpeg', bytes: JPEG }, REDUCED, {
      contentType: 'image/webp',
      bytes: WEBP,
    })
    expect(await served(bridge, ORIGINAL)).toMatchObject({
      status: 200,
      type: 'image/webp',
      bytes: WEBP,
    })
  })

  it('is a rendition in place of an animation past the budget, or one too large to decode', async () => {
    const rendition = { contentType: 'image/webp', bytes: WEBP }
    for (const plan of [
      { ...REDUCED, firstFrameOnly: true },
      { ...REDUCED, refused: true },
    ]) {
      const { bridge } = bridgeServing({ contentType: 'image/gif', bytes: GIF }, plan, rendition)
      expect(await served(bridge, ORIGINAL)).toMatchObject({ status: 200, type: 'image/webp' })
    }
  })

  it('fails to load, uncached, past the budget with no rendition yet', async () => {
    const { bridge } = bridgeServing({ contentType: 'image/jpeg', bytes: JPEG }, REDUCED, null)
    expect(await served(bridge, ORIGINAL)).toMatchObject({
      status: 413,
      cache: 'no-store',
      bytes: new Uint8Array(),
    })
  })

  it('refuses a rendition that is not a picture', async () => {
    const { bridge } = bridgeServing({ contentType: 'image/jpeg', bytes: JPEG }, REDUCED, {
      contentType: 'image/webp',
      bytes: MP4,
    })
    expect((await served(bridge, ORIGINAL)).status).toBe(415)
  })

  it('is served as it is when its size could not be read, having no rendition either', async () => {
    const unmeasured = { edge: 2508, firstFrameOnly: true, refused: false, measured: false }
    const { bridge } = bridgeServing({ contentType: 'image/jpeg', bytes: JPEG }, unmeasured, null)
    expect((await served(bridge, ORIGINAL)).status).toBe(200)
  })

  it('plans no video, rendition or thumbnail', async () => {
    const video = bridgeServing({ contentType: 'video/mp4', bytes: MP4 }, REDUCED, null)
    expect(await served(video.bridge, ORIGINAL)).toMatchObject({ status: 200, type: 'video/mp4' })
    const rendition = bridgeServing({ contentType: 'image/jpeg', bytes: JPEG }, REDUCED, {
      contentType: 'image/jpeg',
      bytes: JPEG,
    })
    expect((await served(rendition.bridge, 'session-media://rendition/4/0')).status).toBe(200)
    expect((await served(rendition.bridge, 'session-media://thumbnail/4/0')).status).toBe(200)
    expect(video.planDecode).not.toHaveBeenCalled()
    expect(rendition.planDecode).not.toHaveBeenCalled()
  })
})
