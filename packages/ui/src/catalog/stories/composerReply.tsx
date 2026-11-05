import { ELEMENT } from '@session/test-ids'

import { ComposerReply } from '../../ComposerReply'
import type { QuotedMessage } from '../../quotePreview'
import { useCatalogPicture } from '../pictures'
import { defineStory } from '../story'
import { QUOTE_LABELS } from './quote'
import { noop } from './shared'

interface ReplyRow {
  author: string
  /** Absent: what is being answered was deleted while the reply was written. */
  quoted?: (Omit<QuotedMessage, 'id' | 'outgoing'> & { picture?: number | undefined }) | undefined
}

function Bar({ author, quoted }: ReplyRow) {
  const uri = useCatalogPicture(quoted?.picture)
  const message =
    quoted === undefined
      ? undefined
      : {
          id: 1,
          outgoing: false,
          body: quoted.body,
          attachments: quoted.attachments.map((attachment) => ({ ...attachment, uri })),
        }
  return (
    <ComposerReply
      replyingToLabel="Replying to"
      author={author}
      message={message}
      labels={QUOTE_LABELS}
      onClose={noop}
      closeLabel="Close"
      testID={ELEMENT.conversation.composerReply}
      closeTestID={ELEMENT.conversation.composerReplyClose}
      thumbnailTestID={ELEMENT.conversation.composerReplyThumbnail}
    />
  )
}

const JPEG = { contentType: 'image/jpeg', voiceMessage: false } as const

export const composerReply = defineStory<ReplyRow>({
  component: 'composerReply',
  story: 'bar',
  width: 420,
  pictures: true,
  forced: ['hover', 'focus'],
  sensitive: { rtl: true, responsive: true },
  variants: {
    text: { author: 'Bob', quoted: { body: 'Are we still on for Thursday?', attachments: [] } },
    longText: {
      author: 'Maximilian-Alexander von Hohenzollern-Sigmaringen',
      quoted: {
        body: 'Are we still on for Thursday? I might bring Sam along if that is fine with you',
        attachments: [],
      },
    },
    picture: { author: 'Bob', quoted: { body: '', attachments: [JPEG], picture: 0 } },
    mixed: {
      author: 'You',
      quoted: { body: 'The view from the top, totally worth it', attachments: [JPEG], picture: 2 },
    },
    file: {
      author: 'Bob',
      quoted: {
        body: '',
        attachments: [
          {
            contentType: 'application/pdf',
            voiceMessage: false,
            filename: 'Lease agreement 2026 signed by both parties final.pdf',
          },
        ],
      },
    },
    voice: {
      author: 'Bob',
      quoted: { body: '', attachments: [{ contentType: 'audio/aac', voiceMessage: true }] },
    },
    notFound: { author: 'Bob' },
    arabic: { author: 'أنت', quoted: { body: 'هل وصلت الطرود اليوم؟', attachments: [] } },
  },
  render: (row) => <Bar {...row} />,
})
