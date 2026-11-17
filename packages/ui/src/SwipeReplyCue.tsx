import { YStack } from 'tamagui'

import { Icon } from './Icon'

/** The reply glyph the swipe uncovers at the row's trailing edge. */
export function SwipeReplyCue() {
  return (
    <YStack
      width="$xl"
      height="$xl"
      borderRadius="$full"
      backgroundColor="$messageBubbleIncomingBg"
      alignItems="center"
      justifyContent="center"
      aria-hidden
    >
      <Icon name="reply" size="sm" color="$messageBubbleIncomingText" />
    </YStack>
  )
}
