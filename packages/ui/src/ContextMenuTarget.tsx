import type { MouseEvent } from 'react'
import { YStack } from 'tamagui'

import type { ContextMenuTargetProps } from './ContextMenuTarget.types'
import { currentPageZoom } from './pageZoom'

export type { ContextMenuTargetProps }

/** Whether the reader has text selected inside `element`, which the window's own Copy is for. */
function selectsTextIn(element: Element): boolean {
  const selection = globalThis.getSelection?.()
  if (selection === null || selection === undefined || selection.isCollapsed) return false
  return element.contains(selection.anchorNode) || element.contains(selection.focusNode)
}

/**
 * The web half: a right-click opens the menu at the pointer.
 *
 * **Not over a text selection inside it.** There the click is left to the window, whose own menu
 * copies what was selected; the app's menu acts on the whole message.
 */
export function ContextMenuTarget({
  onOpen,
  alignSelf,
  maxWidth,
  children,
}: ContextMenuTargetProps) {
  return (
    <YStack
      {...(alignSelf === undefined ? {} : { alignSelf })}
      {...(maxWidth === undefined ? {} : { maxWidth })}
      onContextMenu={(event: MouseEvent) => {
        if (selectsTextIn(event.currentTarget)) return
        event.preventDefault()
        // In the window's pixels, as `measureAnchor` reads them, and placed inside the zoomed page.
        const zoom = currentPageZoom()
        onOpen({ kind: 'point', x: event.clientX / zoom, y: event.clientY / zoom })
      }}
    >
      {children}
    </YStack>
  )
}
