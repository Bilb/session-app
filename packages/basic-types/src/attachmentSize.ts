import { MAX_ATTACHMENT_BYTES } from './media'
import type { WithContentType, WithDecodesHeic } from './with'

const ENCRYPT_HEADER = 24
const ENCRYPT_CHUNK_SIZE = 32_768
const ENCRYPT_CHUNK_OVERHEAD = 17
const ENCRYPTED_CHUNK_TOTAL = ENCRYPT_CHUNK_SIZE + ENCRYPT_CHUNK_OVERHEAD

/** The largest power of two not above `n`, as C++'s `std::bit_floor`. */
function bitFloor(n: number): number {
  return 2 ** Math.floor(Math.log2(n))
}

/** libsession's `encrypted_padding`, line for line. */
function encryptedPadding(dataSize: number): number {
  const prefixSize = 1 + ENCRYPT_HEADER
  const minPadding = 1
  const streamChunks = Math.ceil(dataSize / ENCRYPT_CHUNK_SIZE)
  const encSize = dataSize + prefixSize + minPadding + streamChunks * ENCRYPT_CHUNK_OVERHEAD
  const padFactor = bitFloor(Math.max(encSize, 131_072)) / 32
  const paddedSize = Math.ceil(encSize / padFactor) * padFactor
  let padding = paddedSize - encSize + minPadding

  let implicitPadding = 0
  if (padding >= ENCRYPTED_CHUNK_TOTAL)
    implicitPadding = Math.floor(padding / ENCRYPTED_CHUNK_TOTAL) * ENCRYPT_CHUNK_OVERHEAD
  const freePadding = streamChunks * ENCRYPT_CHUNK_SIZE - dataSize
  if (padding % ENCRYPTED_CHUNK_TOTAL > freePadding) implicitPadding += ENCRYPT_CHUNK_OVERHEAD
  padding -= implicitPadding
  return padding
}

/**
 * The bytes a file of this size uploads as: libsession's `attachment::encrypted_size`.
 *
 * What the file server's limit is checked against, so a picker's plaintext size has to go through
 * this before it is compared. Ported rather than asked for: the bridge carries no such call, and
 * the screen has to answer at staging, before anything reaches libsession.
 */
export function encryptedAttachmentSize(plaintextBytes: number): number {
  const padding = encryptedPadding(plaintextBytes)
  const paddedSize = plaintextBytes + padding
  const tagsSize = Math.ceil(paddedSize / ENCRYPT_CHUNK_SIZE) * ENCRYPT_CHUNK_OVERHEAD
  return 1 + ENCRYPT_HEADER + plaintextBytes + padding + tagsSize
}

/**
 * libsession's `image::can_decode` in this build, by declared type: every picture it decodes is
 * sent re-encoded (`image::sendable`), shrunk until it fits the file server. HEIC needs a platform
 * decoder, since the static libvips carries none for HEVC: ImageIO on iOS and macOS, nothing else.
 */
const SHRUNK_TO_FIT: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])
const HEIC: ReadonlySet<string> = new Set(['image/heic', 'image/heif'])

/**
 * Whether a picked file can be sent at all: within the file server's limit, or a picture
 * libsession shrinks to fit. A size the platform did not report passes, as there is nothing to
 * check; so does an animated PNG, typed as any PNG, which libsession sends as it is and refuses
 * only when its upload comes up.
 */
export function fitsAttachmentLimit(
  file: WithContentType & { size?: number | undefined },
  { decodesHeic }: WithDecodesHeic,
): boolean {
  if (file.size === undefined || encryptedAttachmentSize(file.size) <= MAX_ATTACHMENT_BYTES)
    return true
  const type = file.contentType?.split(';')[0]?.trim().toLowerCase()
  if (type === undefined) return false
  return SHRUNK_TO_FIT.has(type) || (decodesHeic && HEIC.has(type))
}
