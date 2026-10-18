import {
  contentTypeEssence,
  encryptedAttachmentSize,
  MAX_ATTACHMENT_BYTES,
  type WithDecodesHeic,
} from '@session/basic-types'
import type { SendPlan } from '@session/bridge-types'

/**
 * The pictures libsession decodes in this build, and so re-encodes to send: libvips's loaders.
 * HEIC needs a platform decoder, since the static libvips carries none for HEVC: ImageIO on iOS
 * and macOS, nothing else.
 */
const REENCODED: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])
const HEIC: ReadonlySet<string> = new Set(['image/heic', 'image/heif'])

/** Whether libsession re-encodes a picture of this declared type to send it. */
export function isReencoded(contentType: string, { decodesHeic }: WithDecodesHeic): boolean {
  const type = contentTypeEssence(contentType) ?? ''
  return REENCODED.has(type) || (decodesHeic && HEIC.has(type))
}

/** Types whose pictures may carry alpha or frames, which libsession re-encodes as WebP. */
const REENCODED_AS_WEBP: ReadonlySet<string> = new Set(['image/png', 'image/webp', 'image/gif'])

/**
 * The type libsession gives a picture it re-encodes: WebP where it has alpha or is animated, else
 * JPEG. Read from the declared type, since the fake holds no bytes to look for either.
 */
export function reencodedContentType(contentType: string): 'image/jpeg' | 'image/webp' {
  return REENCODED_AS_WEBP.has(contentTypeEssence(contentType) ?? '') ? 'image/webp' : 'image/jpeg'
}

/**
 * libsession's `image::send_plan` for a file of this type and size, read from its declared type
 * where libsession reads its header: the fake holds no bytes. So it cannot tell an animated PNG
 * (`original-animated-png`), a picture past the decode limits (`too-large-to-decode`) or a damaged
 * header (`unreadable`) from any other of its type, and goes by the label where libsession goes by
 * the content. A size that is not known fits.
 */
export function fakeSendPlan(
  contentType: string,
  sizeBytes: number | undefined,
  options: WithDecodesHeic,
): SendPlan {
  if (isReencoded(contentType, options)) return 'reencoded'
  if (sizeBytes !== undefined && encryptedAttachmentSize(sizeBytes) > MAX_ATTACHMENT_BYTES)
    return 'too-large-for-server'
  return contentTypeEssence(contentType)?.startsWith('image/') === true
    ? 'original-cannot-decode'
    : 'as-is'
}
