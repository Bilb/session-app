import { SPACING } from '@session/theme-tokens'
import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

/** The frame's inset at each side, so content of a fixed width can be given room for it. */
export const MESSAGE_FRAME_INSET_PX = SPACING.md

export interface MessageFrameProps {
  /** Ours, on the accent; otherwise theirs, on the incoming surface. */
  outgoing: boolean
  /** Where it sits in the conversation; unset, it fills what it is given. */
  alignSelf?: 'flex-start' | 'flex-end' | undefined
  maxWidth?: number | `${number}%` | undefined
  testID?: string | undefined
  children: ReactNode
}

/**
 * A conversation message's bubble, holding its body, attachments and send state alike: what
 * `onAccent` and the incoming inks are drawn on. `MessageBubble` is onboarding's text-only one.
 */
export function MessageFrame({
  outgoing,
  alignSelf,
  maxWidth,
  testID,
  children,
}: MessageFrameProps) {
  return (
    <YStack
      {...(alignSelf === undefined ? {} : { alignSelf })}
      {...(maxWidth === undefined ? {} : { maxWidth })}
      backgroundColor={outgoing ? '$primaryColor' : '$messageBubbleIncomingBg'}
      borderRadius="$lg"
      paddingHorizontal={MESSAGE_FRAME_INSET_PX}
      paddingVertical="$sm"
      gap="$2xs"
      testID={testID}
    >
      {children}
    </YStack>
  )
}
