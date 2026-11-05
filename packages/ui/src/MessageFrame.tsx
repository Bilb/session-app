import { RADII, SPACING } from '@session/theme-tokens'
import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

import { LandingHighlight } from './LandingHighlight'

/** The frame's inset at each side, so content of a fixed width can be given room for it. */
export const MESSAGE_FRAME_INSET_PX = SPACING.md
/** The frame's inset above and below its content. */
export const MESSAGE_FRAME_INSET_BLOCK_PX = SPACING.sm

export interface MessageFrameProps {
  /** Ours, on the accent; otherwise theirs, on the incoming surface. */
  outgoing: boolean
  /** Where it sits in the conversation; unset, it fills what it is given. */
  alignSelf?: 'flex-start' | 'flex-end' | undefined
  maxWidth?: number | `${number}%` | undefined
  /**
   * Changes each time a jump lands on this message, which plays the highlight once more: a ring
   * fading over 1.6 s, or under reduced motion shown and removed. Absent: never landed on.
   */
  highlightSerial?: number | undefined
  /** The highlight at full strength and held, for a picture of a landing. */
  highlightHeld?: boolean | undefined
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
  highlightSerial,
  highlightHeld = false,
  testID,
  children,
}: MessageFrameProps) {
  return (
    <YStack
      {...(alignSelf === undefined ? {} : { alignSelf })}
      {...(maxWidth === undefined ? {} : { maxWidth })}
      position="relative"
      backgroundColor={outgoing ? '$primaryColor' : '$messageBubbleIncomingBg'}
      borderRadius="$lg"
      paddingHorizontal={MESSAGE_FRAME_INSET_PX}
      paddingVertical={MESSAGE_FRAME_INSET_BLOCK_PX}
      gap="$2xs"
      testID={testID}
    >
      {highlightSerial === undefined && !highlightHeld ? null : (
        <LandingHighlight
          serial={highlightSerial}
          still={highlightHeld}
          outgoing={outgoing}
          radiusPx={RADII.lg}
        />
      )}
      {children}
    </YStack>
  )
}
