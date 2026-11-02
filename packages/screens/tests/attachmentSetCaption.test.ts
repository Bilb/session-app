import { describe, expect, it } from 'vitest'

import type { AttachmentSet } from '#src/attachmentSet'
import { sharedCaption } from '#src/attachmentSetCaption'

function set(
  state: AttachmentSet['state'],
  count: number,
  sizeBytes: number | undefined,
): AttachmentSet {
  return { state, count, sizeBytes, doneBytes: 0, totalBytes: 0, failed: 0, unreadable: 0 }
}

describe('a set’s caption', () => {
  it.each(['idle', 'ready'] as const)('is the size and then the count when %s', (state) => {
    expect(sharedCaption(set(state, 12, 29_900_000))).toBe('29.9 MB · 12 attachments')
    expect(sharedCaption(set(state, 2, 780_000))).toBe('780 kB · 2 attachments')
  })

  it.each(['idle', 'ready'] as const)('is the count alone when %s of no known size', (state) => {
    expect(sharedCaption(set(state, 1, undefined))).toBe('1 attachment')
  })
})
