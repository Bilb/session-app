import type { MouseEvent } from 'react'
import { YStack } from 'tamagui'

import type { ContextMenuTargetProps } from './ContextMenuTarget.types'
import { ContextMenuOpener } from './menuLongPress'
import { currentPageZoom } from './pageZoom'

export type { ContextMenuTargetProps }

/** Whether the reader has text selected inside `element`, which the window's own Copy is for. */
function selectsTextIn(element: Element): boolean {
  const selection = globalThis.getSelection?.()
  if (selection === null || selection === undefined || selection.isCollapsed) return false
  return element.contains(selection.anchorNode) || element.contains(selection.focusNode)
}

/** Whether the reader has any text selected, which a double-click must not replace or act over. */
function selectsText(): boolean {
  const selection = globalThis.getSelection?.()
  return selection !== null && selection !== undefined && !selection.isCollapsed
}

/** A press on a control inside the target is that control's, not the message's. */
function onControl(event: MouseEvent): boolean {
  const control = (event.target as Element).closest('button, a, input, textarea, [role="button"]')
  return control !== null && event.currentTarget.contains(control)
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
  onDoublePress,
  children,
}: ContextMenuTargetProps) {
  return (
    // Provided on the web too, so a control reads one contract on both; only native acts on it.
    <ContextMenuOpener.Provider value={onOpen}>
      <YStack
        {...(alignSelf === undefined ? {} : { alignSelf })}
        {...(maxWidth === undefined ? {} : { maxWidth })}
        onContextMenu={(event: MouseEvent) => {
          if (selectsTextIn(event.currentTarget)) return
          event.preventDefault()
          // In the window's pixels, as `measureAnchor` reads them, placed inside the zoomed page.
          const zoom = currentPageZoom()
          onOpen({ kind: 'point', x: event.clientX / zoom, y: event.clientY / zoom })
        }}
        {...(onDoublePress === undefined
          ? {}
          : {
              // The second press of a double-click selects the word under it, before the
              // double-click is reported: stopped here, so the double-click finds none selected.
              onMouseDown: (event: MouseEvent) => {
                if (event.detail === 2 && !selectsText() && !onControl(event))
                  event.preventDefault()
              },
              onDoubleClick: (event: MouseEvent) => {
                if (!selectsText() && !onControl(event)) onDoublePress()
              },
            })}
      >
        {children}
      </YStack>
    </ContextMenuOpener.Provider>
  )
}
