import { YStack } from 'tamagui'

import { InteractionOverride } from '../../interactionOverride'
import { MessageFrame } from '../../MessageFrame'
import { Text } from '../../Text'
import { defineStory } from '../story'
import { LONG } from './shared'

interface FrameRow {
  outgoing: boolean
  body: string
  /** Focused on every page, the right-to-left one included, which draws no forced states. */
  focused?: boolean
}

const FOCUSED = { hovered: false, pressed: false, focused: true } as const

function Frame({ outgoing, body }: FrameRow) {
  return (
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
  )
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
    incomingFocused: { outgoing: false, body: 'Are we still on for Thursday?', focused: true },
    outgoingFocused: { outgoing: true, body: 'Yes, 7pm', focused: true },
  },
  render: ({ focused = false, ...row }) => (
    // Room for the ring, which is drawn outside the frame.
    <YStack padding="$xs">
      {focused ? (
        <InteractionOverride.Provider value={FOCUSED}>
          <Frame {...row} />
        </InteractionOverride.Provider>
      ) : (
        <Frame {...row} />
      )}
    </YStack>
  ),
})
