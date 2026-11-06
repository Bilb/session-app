import { createContext, useContext, useMemo } from 'react'
import type { GestureResponderEvent } from 'react-native'
import { isWeb } from 'tamagui'

import { measureAnchor } from './anchorRect'
import type { MenuAnchor } from './contextMenuPlacement'

/** Opens the context menu of the `ContextMenuTarget` around it; null outside one. */
export const ContextMenuOpener = createContext<((anchor: MenuAnchor) => void) | null>(null)

/** What a press control spreads onto itself; empty where it opens nothing. */
export interface MenuLongPressProps {
  onLongPress?: (event: GestureResponderEvent) => void
}

const NONE: MenuLongPressProps = {}

/**
 * A long press on a control inside a `ContextMenuTarget` opens the target's menu.
 *
 * **Native only, and needed there.** The innermost view that takes a press becomes the touch's
 * responder, so a long press that starts on an attachment tile, a file row or a button never
 * reaches the target's own handler. Each such control spreads this to hand its long press up; the
 * press it would have fired on release is then not fired. On the web a right-click bubbles to the
 * target by itself.
 */
export function useMenuLongPress(): MenuLongPressProps {
  const open = useContext(ContextMenuOpener)
  // The same props for the same opener, so a memoised control is not re-rendered by them.
  return useMemo(() => {
    if (isWeb || open === null) return NONE
    return {
      onLongPress: (event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent
        if (typeof pageX === 'number' && typeof pageY === 'number') {
          open({ kind: 'point', x: pageX, y: pageY })
          return
        }
        measureAnchor(event.currentTarget, (rect) => {
          if (rect !== null) open({ kind: 'element', rect })
        })
      },
    }
  }, [open])
}
