import { describe, expect, it } from 'vitest'

import {
  quoteAccessibleName,
  quotePreview,
  type QuotedAttachment,
  type QuotedMessage,
  type QuoteLabels,
} from '#src/quotePreview'

const LABELS: QuoteLabels = {
  image: 'Image',
  gif: 'GIF',
  video: 'Video',
  audio: 'Audio',
  voiceMessage: 'Voice Message',
  document: 'Document',
  notFound: 'Original message not found',
  andMore: (count) => `+${String(count)}`,
}

const JPEG: QuotedAttachment = { contentType: 'image/jpeg', voiceMessage: false }

function quoted(body: string, attachments: QuotedAttachment[] = []): QuotedMessage {
  return { id: 7, outgoing: false, body, attachments }
}

describe('what a quote says', () => {
  it('is the body, on two lines, for text', () => {
    expect(quotePreview(quoted('Are we still on?'), LABELS)).toMatchObject({
      found: true,
      kind: 'text',
      text: 'Are we still on?',
      lines: 2,
      visual: null,
    })
  })

  it.each([
    ['a picture', JPEG, 'Image'],
    ['a GIF', { contentType: 'image/gif', voiceMessage: false }, 'GIF'],
    ['a video', { contentType: 'video/mp4', voiceMessage: false }, 'Video'],
    ['a voice message', { contentType: 'audio/aac', voiceMessage: true }, 'Voice Message'],
    ['an unnamed audio file', { contentType: 'audio/mpeg', voiceMessage: false }, 'Audio'],
    ['an unnamed file', { contentType: 'application/pdf', voiceMessage: false }, 'Document'],
  ])('is the kind, on one line, for %s with no body', (_kind, attachment, label) => {
    expect(quotePreview(quoted('', [attachment]), LABELS)).toMatchObject({
      text: label,
      isFileName: false,
      lines: 1,
    })
  })

  it('is the name of a file or an audio file that has one', () => {
    const file = { contentType: 'application/pdf', voiceMessage: false, filename: 'lease.pdf' }
    expect(quotePreview(quoted('', [file]), LABELS)).toMatchObject({
      text: 'lease.pdf',
      isFileName: true,
      more: null,
    })
  })

  it('follows the first file’s name with how many more there are', () => {
    const file = { contentType: 'application/pdf', voiceMessage: false, filename: 'a.pdf' }
    expect(quotePreview(quoted('', [file, file, file]), LABELS)).toMatchObject({
      text: 'a.pdf',
      more: '+2',
    })
  })

  it('keeps the body over the kind when a message has both', () => {
    expect(quotePreview(quoted('The view', [JPEG]), LABELS)).toMatchObject({
      kind: 'image',
      text: 'The view',
      lines: 2,
      visual: { type: 'picture' },
    })
  })

  it.each([
    ['held nowhere', undefined],
    ['deleted', { ...quoted('Gone'), deleted: true }],
  ])('is "not found", with nothing beside it, for an original %s', (_why, message) => {
    expect(quotePreview(message, LABELS)).toEqual({
      found: false,
      kind: 'text',
      text: 'Original message not found',
      isFileName: false,
      more: null,
      lines: 1,
      visual: null,
    })
  })
})

describe('what a quote shows beside its words', () => {
  it('passes a picture’s thumbnail and ThumbHash to the tile, which picks between them', () => {
    const picture = { ...JPEG, uri: 'thumb://1', thumbhash: 'hash://1' }
    expect(quotePreview(quoted('', [picture]), LABELS).visual).toEqual({
      type: 'picture',
      uri: 'thumb://1',
      thumbhash: 'hash://1',
      badge: undefined,
    })
  })

  it('counts the rest of an album on its first picture', () => {
    expect(quotePreview(quoted('', [JPEG, JPEG, JPEG, JPEG, JPEG]), LABELS).visual).toMatchObject({
      type: 'picture',
      badge: '+4',
    })
  })

  it('badges a GIF as one, and never as anything that moves', () => {
    const gif = { contentType: 'image/gif', voiceMessage: false, uri: 'thumb://1' }
    expect(quotePreview(quoted('', [gif]), LABELS).visual).toMatchObject({ badge: 'GIF' })
  })

  it('draws a video’s glyph until libsession has a still of it, then the still with play', () => {
    const video = { contentType: 'video/mp4', voiceMessage: false }
    expect(quotePreview(quoted('', [video]), LABELS).visual).toEqual({
      type: 'glyph',
      icon: 'video',
    })
    expect(quotePreview(quoted('', [{ ...video, uri: 'thumb://1' }]), LABELS).visual).toMatchObject(
      { type: 'picture', play: true },
    )
  })

  it.each([
    ['a voice message', { contentType: 'audio/aac', voiceMessage: true }, 'mic'],
    ['an audio file', { contentType: 'audio/mpeg', voiceMessage: false }, 'volume'],
    [
      'a PDF',
      { contentType: 'application/pdf', voiceMessage: false, filename: 'a.pdf' },
      'fileText',
    ],
  ])('draws a glyph for %s', (_kind, attachment, icon) => {
    expect(quotePreview(quoted('', [attachment]), LABELS).visual).toEqual({ type: 'glyph', icon })
  })

  it('draws the gone glyph for an attachment that is gone and left no thumbnail', () => {
    const gone = { ...JPEG, unavailable: true }
    expect(quotePreview(quoted('', [gone]), LABELS)).toMatchObject({
      text: 'Image',
      visual: { type: 'glyph', icon: 'ban' },
    })
  })

  it('still draws the thumbnail of one that is gone, while libsession holds it', () => {
    const gone = { ...JPEG, unavailable: true, uri: 'thumb://1' }
    expect(quotePreview(quoted('', [gone]), LABELS).visual).toMatchObject({ type: 'picture' })
  })
})

describe('the name a screen reader gives a quote', () => {
  it('is the author and the summary, the count included', () => {
    expect(
      quoteAccessibleName('Bob', quotePreview(quoted('Beach day', [JPEG, JPEG]), LABELS)),
    ).toBe('Bob: Beach day +1')
  })

  it('says not found under the author, who is always known', () => {
    expect(quoteAccessibleName('Bob', quotePreview(undefined, LABELS))).toBe(
      'Bob: Original message not found',
    )
  })
})
