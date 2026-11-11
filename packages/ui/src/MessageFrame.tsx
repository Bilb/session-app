import { SPACING } from '@session/theme-tokens'
import type { ReactNode } from 'react'
import { isWeb, YStack } from 'tamagui'

import { useForcedFocus } from './interactionOverride'
import { focusRing } from './keyboardPress'
import { useListStop } from './listFocus'

/** The frame's inset at each side, so content of a fixed width can be given room for it. */
export const MESSAGE_FRAME_INSET_PX = SPACING.md

/** Outside the bubble, so it shows against the page beside an accent fill as well. */
const RING = focusRing({ onAccent: false, offset: 2, radius: '$lg' })

export interface MessageFrameProps {
  /** Ours, on the accent; otherwise theirs, on the incoming surface. */
  outgoing: boolean
  /** Where it sits in the conversation; unset, it fills what it is given. */
  alignSelf?: 'flex-start' | 'flex-end' | undefined
  maxWidth?: number | `${number}%` | undefined
  /**
   * A message the desktop keyboard moves to: its list row's stop, an article to a screen reader,
   * ringed while focused. Desktop only; a phone's reader moves between messages by itself.
   */
  focusable?: boolean | undefined
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
  focusable = false,
  testID,
  children,
}: MessageFrameProps) {
  const stop = useListStop()
  const forcedFocus = useForcedFocus()
  const web = isWeb && focusable

  return (
    <YStack
      {...(web && stop !== null ? { ref: stop.ref } : {})}
      {...(alignSelf === undefined ? {} : { alignSelf })}
      {...(maxWidth === undefined ? {} : { maxWidth })}
      backgroundColor={outgoing ? '$primaryColor' : '$messageBubbleIncomingBg'}
      borderRadius="$lg"
      paddingHorizontal={MESSAGE_FRAME_INSET_PX}
      paddingVertical="$sm"
      gap="$2xs"
      {...(web
        ? {
            role: 'article',
            focusVisibleStyle: RING,
            ...forcedFocus,
            ...(stop === null ? {} : { tabIndex: stop.tabIndex }),
          }
        : {})}
      testID={testID}
    >
      {children}
    </YStack>
  )
}
