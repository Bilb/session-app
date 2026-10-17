import { describe, expect, it } from 'vitest'

import { encryptedAttachmentSize } from '#src/attachmentSize'
import { MAX_ATTACHMENT_BYTES } from '#src/media'

describe('the size a file uploads as', () => {
  it('matches libsession’s own vectors', () => {
    // tests/test_attachment_encrypt.cpp in libsession-util, plaintext -> encrypted.
    const vectors: Array<[number, number]> = [
      [0, 4096],
      [1, 4096],
      [4053, 4096],
      [4054, 8192],
      [8149, 8192],
      [8150, 12288],
      [33333, 36864],
      [60000, 61440],
      [261982, 262144],
      [261983, 270336],
      [523990, 524288],
      [523991, 540672],
      [6543210, 6553600],
      [10000000, 10223616],
      [10218286, 10223616],
      [25000000, 25165824],
    ]
    for (const [plaintext, encrypted] of vectors) {
      expect(encryptedAttachmentSize(plaintext), String(plaintext)).toBe(encrypted)
    }
  })

  it('puts the largest sendable file under 10 MB once padded', () => {
    // The file server's limit is on the upload stream, so a 10,000,000-byte file does not fit.
    expect(encryptedAttachmentSize(9_956_278)).toBeLessThanOrEqual(MAX_ATTACHMENT_BYTES)
    expect(encryptedAttachmentSize(9_956_279)).toBeGreaterThan(MAX_ATTACHMENT_BYTES)
  })
})
