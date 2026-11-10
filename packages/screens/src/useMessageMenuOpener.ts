import type { MenuAnchor } from '@session/ui'
import { useCallback } from 'react'

import { useConversationUi } from './conversationUi'

/**
 * Opens one message's menu, the same function across that message's own updates: every control
 * inside the row reads it through context, so a new one would re-render a memoised tile on each
 * progress tick.
 */
export function useMessageMenuOpener(messageId: number): (anchor: MenuAnchor) => void {
  const { openMenu } = useConversationUi()
  return useCallback(
    (anchor: MenuAnchor) => {
      openMenu(messageId, anchor)
    },
    [openMenu, messageId],
  )
}
