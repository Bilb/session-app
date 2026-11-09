import { describe, expect, it } from 'vitest'

import type { AttachmentSet } from '#src/attachmentSet'
import { sharedCaption } from '#src/attachmentSetCaption'

/** FIRST STRONG ISOLATE and POP DIRECTIONAL ISOLATE: what keeps a part whole in RTL text. */
const FSI = '\u2068'
const PDI = '\u2069'
/** LEFT-TO-RIGHT MARK and RIGHT-TO-LEFT MARK: what starts the line from the layout's edge. */
const LRM = '\u200E'
const RLM = '\u200F'

const visible = (text: string | null) => text?.replace(/[\u2068\u2069\u200E\u200F]/g, '')

function set(
  state: AttachmentSet['state'],
  count: number,
  sizeBytes: number | undefined,
): AttachmentSet {
  return { state, count, sizeBytes, doneBytes: 0, totalBytes: 0, failed: 0, unreadable: 0 }
}

describe('a set’s caption', () => {
  it.each(['idle', 'ready'] as const)('is the size and then the count when %s', (state) => {
    expect(visible(sharedCaption(set(state, 12, 29_900_000)))).toBe('29.9 MB · 12 attachments')
    expect(visible(sharedCaption(set(state, 2, 780_000)))).toBe('780 kB · 2 attachments')
  })

  it.each(['idle', 'ready'] as const)('is the count alone when %s of no known size', (state) => {
    expect(sharedCaption(set(state, 1, undefined))).toBe('1 attachment')
  })

  // The RTL page shows the order the marks make, but a picture cannot tell them from luck.
  it('isolates the size and the count, so neither is reordered inside the other', () => {
    expect(sharedCaption(set('ready', 1, 180_000))).toBe(
      `${LRM}${FSI}180 kB${PDI} · ${FSI}1 attachment${PDI}`,
    )
  })

  // Every part is a figure or a Latin word, so without the mark the line would read left to right
  // in a right-to-left layout too.
  it('starts from the right in a right-to-left layout', () => {
    document.documentElement.dir = 'rtl'
    try {
      expect(sharedCaption(set('ready', 1, 180_000))).toBe(
        `${RLM}${FSI}180 kB${PDI} · ${FSI}1 attachment${PDI}`,
      )
    } finally {
      document.documentElement.dir = 'ltr'
    }
  })
})
