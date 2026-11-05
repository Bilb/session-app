import {
  contentTypeEssence,
  type WithContentType,
  type WithMediaThumbhash,
  type WithMediaUri,
} from '@session/basic-types'

import { fileGlyph } from './attachmentFile'
import type { IconName } from './Icon.types'

/**
 * One attachment of a quoted message, as a quote draws it. `uri` is libsession's thumbnail and
 * `thumbhash` the sender's placeholder, each resolved like a tile's.
 */
export type QuotedAttachment = WithContentType &
  WithMediaUri &
  WithMediaThumbhash & {
    filename?: string | undefined
    voiceMessage: boolean
    /** The file server no longer holds it, or its bytes cannot be read. */
    unavailable?: boolean | undefined
  }

/** The message a reply points at, one level deep: its own quote is never drawn. */
export interface QuotedMessage {
  id: number
  outgoing: boolean
  body: string
  attachments: readonly QuotedAttachment[]
  /** Deleted here or everywhere; drawn as not found, since nothing is left to show. */
  deleted?: boolean | undefined
}

/** Already worded, for a package that cannot reach the catalogue. */
export interface QuoteLabels {
  image: string
  gif: string
  video: string
  audio: string
  voiceMessage: string
  document: string
  notFound: string
  /** `andMore`: "+4". */
  andMore: (count: number) => string
}

/** The colour a quote's words and glyphs take on what it is drawn on. */
export type QuoteInk = '$onAccent' | '$messageBubbleIncomingText' | '$textPrimary'

export type QuoteKind = 'text' | 'image' | 'gif' | 'video' | 'voice' | 'audio' | 'file'

/** What sits on the trailing side: a picture, a glyph on a plain tile, or nothing. */
export type QuoteVisual =
  | (WithMediaUri &
      WithMediaThumbhash & {
        type: 'picture'
        /** Over the picture's corner: the album's "+4", or "GIF". */
        badge?: string | undefined
        /** A video's still, which carries the play glyph. */
        play?: boolean | undefined
      })
  | { type: 'glyph'; icon: IconName }

export interface QuotePreview {
  found: boolean
  kind: QuoteKind
  /** The body, the kind's label, or a file's name. */
  text: string
  /** A file or audio name, drawn losing its middle rather than its extension. */
  isFileName: boolean
  /**
   * The rest of a message's attachments, "+4": over an album's picture, or after a file's name.
   */
  more: string | null
  /** The body wraps to two lines; a label or a name takes one. */
  lines: 1 | 2
  visual: QuoteVisual | null
}

function kindOf(attachment: QuotedAttachment): Exclude<QuoteKind, 'text'> {
  if (attachment.voiceMessage) return 'voice'
  const type = contentTypeEssence(attachment.contentType) ?? ''
  if (type === 'image/gif') return 'gif'
  const family = type.split('/')[0]
  if (family === 'image' || family === 'video' || family === 'audio')
    return family === 'audio' ? 'audio' : family
  return 'file'
}

function hasPicture(attachment: QuotedAttachment): boolean {
  return attachment.uri !== undefined && attachment.uri !== null
}

function visualOf(
  kind: Exclude<QuoteKind, 'text'>,
  first: QuotedAttachment,
  more: string | null,
  labels: QuoteLabels,
): QuoteVisual {
  if (first.unavailable === true && !hasPicture(first)) return { type: 'glyph', icon: 'ban' }
  const picture = { type: 'picture', uri: first.uri, thumbhash: first.thumbhash } as const
  switch (kind) {
    case 'image':
      return { ...picture, badge: more ?? undefined }
    case 'gif':
      return { ...picture, badge: more ?? labels.gif }
    // No still exists until libsession makes one, so a video without a thumbnail is its glyph.
    case 'video':
      return hasPicture(first)
        ? { ...picture, badge: more ?? undefined, play: true }
        : { type: 'glyph', icon: 'video' }
    case 'voice':
      return { type: 'glyph', icon: 'mic' }
    case 'audio':
      return { type: 'glyph', icon: 'volume' }
    case 'file':
      return { type: 'glyph', icon: fileGlyph(first.filename ?? '', first.contentType) }
  }
}

/** What a quote of `message` says and shows. Absent is a reference we hold no message for. */
export function quotePreview(
  message: QuotedMessage | undefined,
  labels: QuoteLabels,
): QuotePreview {
  if (message === undefined || message.deleted === true)
    return {
      found: false,
      kind: 'text',
      text: labels.notFound,
      isFileName: false,
      more: null,
      lines: 1,
      visual: null,
    }

  const body = message.body.trim()
  const first = message.attachments[0]
  if (first === undefined)
    return {
      found: true,
      kind: 'text',
      text: body,
      isFileName: false,
      more: null,
      lines: 2,
      visual: null,
    }

  const kind = kindOf(first)
  const count = message.attachments.length
  const more = count > 1 ? labels.andMore(count - 1) : null
  const visual = visualOf(kind, first, more, labels)
  const shown = { found: true, kind, more, visual } as const
  if (body !== '') return { ...shown, text: body, isFileName: false, lines: 2 }

  const named = kind === 'file' || kind === 'audio' ? first.filename : undefined
  if (named !== undefined && named !== '')
    return { ...shown, text: named, isFileName: true, lines: 1 }

  const label = {
    image: labels.image,
    gif: labels.gif,
    video: labels.video,
    voice: labels.voiceMessage,
    audio: labels.audio,
    file: labels.document,
  }[kind]
  return { ...shown, text: label, isFileName: false, lines: 1 }
}

/** "Bob: Image +4", the one name a screen reader gives the whole quote. */
export function quoteAccessibleName(author: string, preview: QuotePreview): string {
  const said = `${author}: ${preview.text}`
  return preview.more === null ? said : `${said} ${preview.more}`
}
