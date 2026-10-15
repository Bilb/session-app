import type { Attachment, Message } from '@session/client'
import { describe, expect, it } from 'vitest'

import {
  failsPast,
  isUploadPhase,
  uploadStateOf,
  uploadSummary,
  whileSending,
} from '#src/uploadState'

function attachment(index: number, uploaded: boolean): Attachment {
  return {
    index,
    contentType: 'image/jpeg',
    voiceMessage: false,
    hasThumbhash: false,
    hasThumbnail: false,
    uploaded,
    availability: 'cached',
    fetchDoneBytes: 0,
    fetchTotalBytes: 0,
  }
}

/** A set of `count` whose first `uploaded` are on the file server. */
function sending(
  sendState: Message['sendState'],
  count: number,
  uploaded: number,
  outgoing = true,
): Message {
  const attachments = Array.from({ length: count }, (_, i) => attachment(i, i < uploaded))
  return { outgoing, sendState, attachments } as unknown as Message
}

const states = (message: Message) => message.attachments.map((a) => uploadStateOf(message, a.index))

describe('a message being sent, file by file', () => {
  it('has the first file without a URL moving and the rest waiting behind it', () => {
    expect(states(sending('uploading', 4, 1))).toEqual([
      'uploaded',
      'uploading',
      'queued',
      'queued',
    ])
  })

  it('pins a failure on the file that was moving, and the rest on never having been tried', () => {
    // File 31 of 32: the thirty before it are up, 32 was never attempted.
    const message = sending('failed', 32, 30)
    expect(uploadStateOf(message, 29)).toBe('uploaded')
    expect(uploadStateOf(message, 30)).toBe('failed')
    expect(uploadStateOf(message, 31)).toBe('notSent')
  })

  it('treats an interrupted send like a failed one', () => {
    expect(states(sending('interrupted', 2, 0))).toEqual(['failed', 'notSent'])
  })

  it('singles out no file when one is missing, since nothing says which', () => {
    expect(states(sending('unsendable', 3, 1))).toEqual(['uploaded', 'notSent', 'notSent'])
  })

  it('finds the first waiting file by index, not by position', () => {
    const message = {
      outgoing: true,
      sendState: 'uploading',
      attachments: [attachment(2, false), attachment(0, true), attachment(1, false)],
    } as unknown as Message
    expect(uploadStateOf(message, 1)).toBe('uploading')
    expect(uploadStateOf(message, 2)).toBe('queued')
  })
})

describe('whether a message is in its upload phase', () => {
  it('is while ours, not all uploaded, and not yet sent', () => {
    expect(isUploadPhase(sending('uploading', 2, 1))).toBe(true)
    expect(isUploadPhase(sending('failed', 2, 1))).toBe(true)
  })

  it('is not once every file is up, whatever happened to the message after', () => {
    expect(isUploadPhase(sending('failed', 2, 2))).toBe(false)
  })

  it('is not for a message somebody else sent or one already sent', () => {
    expect(isUploadPhase(sending('failed', 2, 0, false))).toBe(false)
    expect(isUploadPhase(sending('sent', 2, 0))).toBe(false)
  })
})

describe('the set’s line', () => {
  it('counts what is up and offers a retry only where one can work', () => {
    expect(uploadSummary(sending('failed', 32, 30))).toEqual({
      uploaded: 30,
      count: 32,
      retryable: true,
    })
    expect(uploadSummary(sending('uploading', 3, 1)).retryable).toBe(false)
    expect(uploadSummary(sending('unsendable', 3, 1)).retryable).toBe(false)
  })

  it('says when the failure is behind Show All', () => {
    expect(failsPast(sending('failed', 32, 30), 5)).toBe(true)
    expect(failsPast(sending('failed', 32, 2), 5)).toBe(false)
  })
})

describe('an album of ours while it sends', () => {
  it('opens what is here and offers nothing for what is not', () => {
    const ready = { state: 'ready', doneBytes: 0, totalBytes: 0 } as const
    expect(whileSending(ready)).toBe(ready)
    for (const state of ['idle', 'failed', 'fetching'] as const) {
      expect(whileSending({ state, doneBytes: 5, totalBytes: 10 }), state).toEqual({
        state: 'unavailable',
        doneBytes: 0,
        totalBytes: 0,
      })
    }
  })
})
