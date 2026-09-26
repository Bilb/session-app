import type { Attachment } from '@session/client'
import { describe, expect, it } from 'vitest'

import { mayResolve } from '#src/autoDownload'

function attachment(
  contentType: string,
  availability: Attachment['availability'] = 'absent',
): Attachment {
  return {
    index: 0,
    contentType,
    voiceMessage: false,
    hasPreview: false,
    uploaded: true,
    availability,
    fetchDoneBytes: 0,
    fetchTotalBytes: 0,
  }
}

describe('what drawing may fetch unasked', () => {
  it('follows libsession’s image rule, which is a prefix rather than the viewable list', () => {
    expect(mayResolve(attachment('image/svg+xml'), 'image-attachments')).toBe(true)
    expect(mayResolve(attachment('video/mp4'), 'image-attachments')).toBe(false)
  })

  it('fetches nothing for a conversation nobody has been asked about', () => {
    expect(mayResolve(attachment('image/jpeg'), undefined)).toBe(false)
    expect(mayResolve(attachment('image/jpeg'), 'none')).toBe(false)
  })

  it('draws what is already here whatever the setting', () => {
    expect(mayResolve(attachment('image/jpeg', 'cached'), 'none')).toBe(true)
  })
})
