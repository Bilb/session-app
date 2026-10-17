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
 * What the file server's limit is checked against, so a plaintext size has to go through this
 * before it is compared.
 */
export function encryptedAttachmentSize(plaintextBytes: number): number {
  const padding = encryptedPadding(plaintextBytes)
  const paddedSize = plaintextBytes + padding
  const tagsSize = Math.ceil(paddedSize / ENCRYPT_CHUNK_SIZE) * ENCRYPT_CHUNK_OVERHEAD
  return 1 + ENCRYPT_HEADER + plaintextBytes + padding + tagsSize
}
