import { RADII, SPACING } from '@session/theme-tokens'
import { useCallback, useRef, type ReactNode } from 'react'
import { isWeb, YStack } from 'tamagui'

import { useForcedFocus } from './interactionOverride'
import { focusRing } from './keyboardPress'
import { useListStop } from './listFocus'

import { LandingHighlight } from './LandingHighlight'

/** The frame's inset at each side, so content of a fixed width can be given room for it. */
export const MESSAGE_FRAME_INSET_PX = SPACING.md
/** The frame's inset above and below its content. */
const MESSAGE_FRAME_INSET_BLOCK_PX = SPACING.sm

/** Outside the bubble, so it shows against the page beside an accent fill as well. */
const RING = focusRing({ onAccent: false, offset: 2, radius: '$lg' })

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
  /**
   * A message the desktop keyboard moves to: its list row's stop, an article to a screen reader,
   * ringed while focused. Desktop only; a phone's reader moves between messages by itself.
   */
  focusable?: boolean | undefined
  /**
   * The Menu key or Shift+F10 on the frame or anything inside it, with the frame to anchor a menu
   * to. The key's own context menu is cancelled.
   */
  onMenuKey?: ((frame: unknown) => void) | undefined
  testID?: string | undefined
  children: ReactNode
}

interface MenuKeyEvent {
  key: string
  shiftKey: boolean
  preventDefault: () => void
}

function isMenuKey(event: MenuKeyEvent): boolean {
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)
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
  focusable = false,
  onMenuKey,
  testID,
  children,
}: MessageFrameProps) {
  const stop = useListStop()
  const forcedFocus = useForcedFocus()
  const node = useRef<unknown>(null)
  const web = isWeb && focusable
  const drawStop = web ? stop?.ref : undefined
  // Stable, or each render would take the row out of its list's stops and put it back.
  const ref = useCallback(
    (element: unknown) => {
      node.current = element
      drawStop?.(element)
    },
    [drawStop],
  )

  return (
    <YStack
      ref={ref}
      {...(alignSelf === undefined ? {} : { alignSelf })}
      {...(maxWidth === undefined ? {} : { maxWidth })}
      position="relative"
      backgroundColor={outgoing ? '$primaryColor' : '$messageBubbleIncomingBg'}
      borderRadius="$lg"
      paddingHorizontal={MESSAGE_FRAME_INSET_PX}
      paddingVertical={MESSAGE_FRAME_INSET_BLOCK_PX}
      gap="$2xs"
      {...(web
        ? {
            role: 'article',
            focusVisibleStyle: RING,
            ...forcedFocus,
            ...(stop === null ? {} : { tabIndex: stop.tabIndex, onFocus: stop.onFocus }),
            onKeyDown: (raw: unknown) => {
              const event = raw as MenuKeyEvent
              if (onMenuKey !== undefined && isMenuKey(event)) {
                event.preventDefault()
                onMenuKey(node.current)
                return
              }
              stop?.onKeyDown(raw)
            },
          }
        : {})}
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
