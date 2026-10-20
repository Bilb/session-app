import type { MediaPort } from '@session/app'
import { fromUInt8ArrayToBase64, utf8Encode } from '@session/basic-types'
import type { AttachmentRef } from '@session/client'
import { fakePreviewPixels, photoFileName, type FakeSessionClient } from '@session/client/fake'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** A zlib stream of stored blocks: Hermes has no deflate, and these images are tiny. */
function storedZlib(raw: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [Uint8Array.from([0x78, 0x01])]
  for (let at = 0; at < raw.length || at === 0; at += 0xffff) {
    const data = raw.subarray(at, at + 0xffff)
    const last = at + 0xffff >= raw.length
    const header = new Uint8Array(5)
    header[0] = last ? 1 : 0
    new DataView(header.buffer).setUint16(1, data.length, true)
    new DataView(header.buffer).setUint16(3, ~data.length & 0xffff, true)
    blocks.push(header, data)
  }
  const trailer = new Uint8Array(4)
  new DataView(trailer.buffer).setUint32(0, adler32(raw))
  blocks.push(trailer)
  return concat(blocks)
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  // The CRC covers the type and the data but not the length.
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** A PNG from RGBA8, row-major, not premultiplied: what a ThumbHash decodes to. */
export function encodePng({
  width,
  height,
  rgba,
}: {
  width: number
  height: number
  rgba: Uint8Array
}): Uint8Array {
  const stride = width * 4
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  return concat([
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', storedZlib(raw)),
    chunk('IEND', new Uint8Array(0)),
  ])
}

function dataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${fromUInt8ArrayToBase64(bytes)}`
}

function keyOf({ messageId, index }: AttachmentRef): string {
  return `${String(messageId)}/${String(index)}`
}

/**
 * What an image cannot decode, so a tile keeps its placeholder until the transfer has finished.
 *
 * The real scheme's loader waits for the fetch before it hands anything to the decoder; a file URL
 * would draw at once, so the fake hands this over until the fake's transfer says the bytes are in.
 */
export const NOT_YET = 'data:image/png;base64,'

/**
 * Where an export's bytes come from: the photograph for a picture, a line of text for anything
 * else.
 */
export type ExportSource = { photo: string } | { text: Uint8Array }

export function fakeExportSource(
  client: FakeSessionClient,
  ref: AttachmentRef,
  photos: ReadonlyMap<string, string>,
): ExportSource {
  const photo = photoFileName(client, ref)
  const uri = photo === null ? undefined : photos.get(photo)
  if (uri !== undefined) return { photo: uri }
  return { text: utf8Encode(`fake attachment ${String(ref.messageId)}/${String(ref.index)}\n`) }
}

/**
 * The media port on the fake, until mobile has a native loader to serve it through.
 *
 * Pictures are the dev photographs pushed to the device (`photos`, file URLs by name), and
 * placeholders the fixture's real ThumbHashes, decoded. React Native draws both kinds of URL on
 * both platforms with no plug-in.
 *
 * Resolving an attachment's URL starts the fake's download once, as a native loader would fetch
 * it once and cache it: the URL is the request. The picture is only handed over once that
 * transfer has finished, so under `EXPO_PUBLIC_SESSION_FAKE_SLOWDOWN` the placeholder and the bar
 * show for as long as the transfer takes, as they do on desktop.
 */
export function fakeMediaPort(
  client: FakeSessionClient,
  photos: ReadonlyMap<string, string>,
): MediaPort {
  // Built once per attachment: a screen asks on every render, and a data URL is a string to build.
  const previews = new Map<string, string>()
  const asked = new Set<string>()
  return {
    urlFor(ref) {
      const key = keyOf(ref)
      if (!asked.has(key)) {
        asked.add(key)
        // Deferred: this is called while rendering, and the fetch is what the loader does next.
        setTimeout(() => {
          client.downloadAttachment(ref.messageId, ref.index).catch(() => {
            asked.delete(key)
          })
        }, 0)
      }
      if (!client.isCached(ref)) return NOT_YET
      const photo = photoFileName(client, ref)
      return (photo === null ? undefined : photos.get(photo)) ?? NOT_YET
    },
    previewUrlFor(ref) {
      const key = keyOf(ref)
      let url = previews.get(key)
      if (url === undefined) {
        url = dataUrl(encodePng(fakePreviewPixels(client, ref)))
        previews.set(key, url)
      }
      return url
    },
  }
}
