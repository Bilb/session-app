import { YStack } from 'tamagui'

import { MessageFrame } from '../../MessageFrame'
import { Text } from '../../Text'
import { defineStory } from '../story'
import { LONG } from './shared'

interface FrameRow {
  outgoing: boolean
  body: string
}

/** A message the keyboard has reached: the ring sits outside the bubble, clear of its accent. */
export const messageFrameFocus = defineStory<FrameRow>({
  component: 'messageFrame',
  story: 'focus',
  width: 320,
  forced: ['focus'],
  sensitive: { accent: true, rtl: true },
  variants: {
    incoming: { outgoing: false, body: 'Are we still on for Thursday?' },
    outgoing: { outgoing: true, body: 'Yes, 7pm' },
    incomingLong: { outgoing: false, body: LONG },
    outgoingLong: { outgoing: true, body: LONG },
  },
  render: ({ outgoing, body }) => (
    // Room for the ring, which is drawn outside the frame.
    <YStack padding="$xs">
      <MessageFrame
        outgoing={outgoing}
        focusable
        alignSelf={outgoing ? 'flex-end' : 'flex-start'}
        maxWidth="80%"
      >
        <Text size="$body" color={outgoing ? '$onAccent' : '$messageBubbleIncomingText'}>
          {body}
        </Text>
      </MessageFrame>
    </YStack>
  ),
})
