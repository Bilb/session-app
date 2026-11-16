import { XStack, YStack } from 'tamagui'

import { isLayoutRtl } from '../../layoutDirection'
import { logical } from '../../logicalEdges'
import { MessageFrame } from '../../MessageFrame'
import { SWIPE_REPLY_THRESHOLD_PX, swipeDrawn } from '../../swipeMetrics'
import { SwipeReplyCue } from '../../SwipeReplyCue'
import { Text } from '../../Text'
import { defineStory } from '../story'

interface SwipeRow {
  outgoing: boolean
  /** How far the thumb has travelled, as a share of the threshold. */
  travel: number
}

/**
 * A still of the native swipe, drawn as `SwipeToReply.native` lays it out: the row moved towards
 * the leading edge, the cue uncovered at the trailing one. The desktop has no swipe to draw.
 */
function Swiped({ outgoing, travel }: SwipeRow) {
  const toward = isLayoutRtl() ? 1 : -1
  const offset = swipeDrawn(travel * SWIPE_REPLY_THRESHOLD_PX) * toward
  const progress = Math.min(Math.abs(offset) / SWIPE_REPLY_THRESHOLD_PX, 1)
  return (
    <XStack position="relative" overflow="hidden">
      <YStack
        position="absolute"
        top={0}
        bottom={0}
        {...logical({ insetEnd: 0 })}
        justifyContent="center"
        opacity={progress}
        scale={0.6 + 0.4 * progress}
      >
        <SwipeReplyCue />
      </YStack>
      <YStack flex={1} x={offset}>
        <MessageFrame outgoing={outgoing} alignSelf={outgoing ? 'flex-end' : 'flex-start'}>
          <Text size="$body" color={outgoing ? '$onAccent' : '$messageBubbleIncomingText'}>
            Are we still on for Thursday?
          </Text>
        </MessageFrame>
      </YStack>
    </XStack>
  )
}

export const swipeToReply = defineStory<SwipeRow>({
  component: 'swipeToReply',
  story: 'travel',
  width: 340,
  sensitive: { rtl: true },
  variants: {
    incomingHalfway: { outgoing: false, travel: 0.5 },
    incomingArmed: { outgoing: false, travel: 1 },
    outgoingHalfway: { outgoing: true, travel: 0.5 },
    outgoingArmed: { outgoing: true, travel: 1 },
    outgoingPast: { outgoing: true, travel: 2 },
  },
  render: (row) => <Swiped {...row} />,
})
