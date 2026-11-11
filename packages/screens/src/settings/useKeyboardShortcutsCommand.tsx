import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { useModalEntries, useModals } from '@session/ui'
import { useEffect, useRef } from 'react'

import { KeyboardShortcutsPage } from './KeyboardShortcutsPage'

/**
 * Opens the list of keyboard shortcuts on the menu command (Ctrl+/ or ⌘/), and closes it on the
 * next one, as the legacy desktop client's did. Does nothing where the app handles no keys.
 */
export function useKeyboardShortcutsCommand(): void {
  const modals = useModals()
  const entries = useModalEntries()
  // The command arrives outside React, so it reads the latest of both through refs.
  const openId = useRef<string | null>(null)
  const latestEntries = useRef(entries)
  useEffect(() => {
    latestEntries.current = entries
  }, [entries])

  const shortcuts = requirePorts().window.keyboardShortcuts
  useEffect(() => {
    if (shortcuts === null) return
    return shortcuts.onOpenList(() => {
      const open = openId.current
      if (open !== null && latestEntries.current.some((modal) => modal.id === open)) {
        modals.dismiss(open)
        openId.current = null
        return
      }
      openId.current = modals.present({
        initial: {
          title: tr('keyboardShortcuts'),
          render: () => <KeyboardShortcutsPage names={shortcuts.keyNames} />,
        },
      })
    })
  }, [modals, shortcuts])
}
