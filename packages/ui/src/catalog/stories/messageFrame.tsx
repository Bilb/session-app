import { YStack } from 'tamagui'

import { MessageFrame } from '../../MessageFrame'
import { MessageQuote } from '../../MessageQuote'
import { Text } from '../../Text'
import { defineStory } from '../story'
import { QUOTE_LABELS } from './quote'

interface FrameRow {
  outgoing: boolean
  body: string
  /** Drawn with a quote above the body, as a reply that was landed on when walking back. */
  quoted?: string | undefined
}

function Landed({ outgoing, body, quoted }: FrameRow) {
  return (
    // Room round the frame, which the ring and its glow draw into.
    <YStack padding="$lg">
      <MessageFrame
        outgoing={outgoing}
        alignSelf={outgoing ? 'flex-end' : 'flex-start'}
        maxWidth="90%"
        highlightHeld
      >
        {quoted === undefined ? null : (
          <MessageQuote
            author="Bob"
            message={{ id: 1, outgoing: false, body: quoted, attachments: [] }}
            labels={QUOTE_LABELS}
            onAccent={outgoing}
          />
        )}
        <Text size="$body" color={outgoing ? '$onAccent' : '$messageBubbleIncomingText'}>
          {body}
        </Text>
      </MessageFrame>
    </YStack>
  )
}

/** A jump's landing, at the strength it starts from before it fades. */
export const messageFrameHighlight = defineStory<FrameRow>({
  component: 'messageFrame',
  story: 'highlight',
  width: 340,
  sensitive: { accent: true },
  variants: {
    incoming: { outgoing: false, body: 'Are we still on for Thursday?' },
    outgoing: { outgoing: true, body: 'Yes, 7pm' },
    reply: { outgoing: true, body: 'Agreed', quoted: 'Skip that one' },
    long: {
      outgoing: false,
      body:
        'I looked at the three flats on Saturday. The one near the station is the best value but ' +
        'the kitchen is tiny and the landlord wants six months up front.',
    },
  },
  render: (row) => <Landed {...row} />,
})
