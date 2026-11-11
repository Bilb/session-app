import { SPACING } from '@session/theme-tokens'
import { useCallback, useRef, type ReactNode } from 'react'
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
  /**
   * The keys that open the message's menu, with the frame to anchor it to: Enter or Space on the
   * frame itself, and the Menu key or Shift+F10 on the frame or anything inside it, whose own
   * context menu is cancelled.
   */
  onMenuKey?: ((frame: unknown) => void) | undefined
  testID?: string | undefined
  children: ReactNode
}

interface MenuKeyEvent {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  target: unknown
  currentTarget: unknown
  preventDefault: () => void
}

/**
 * Enter or Space as legacy Session Desktop had them, on the frame only: inside it they press the
 * control that has focus. The Menu key and Shift+F10 are the platform's, from anywhere in it.
 */
function isMenuKey(event: MenuKeyEvent): boolean {
  if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) return true
  const plain = !(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
  return (
    plain && (event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget
  )
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
      {children}
    </YStack>
  )
}
