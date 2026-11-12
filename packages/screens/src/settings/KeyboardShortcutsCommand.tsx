import type { KeyboardShortcutsPort } from '@session/app'
import { tr } from '@session/localization'
import { useModalEntries, useModals } from '@session/ui'
import { useEffect, useRef } from 'react'

import { KEYBOARD_SHORTCUTS_SCREEN, KeyboardShortcutsPage } from './KeyboardShortcutsPage'

/**
 * Opens the list of keyboard shortcuts on the menu command (Ctrl+/ or ⌘/), and closes it on the
 * next one, as the legacy desktop client's did, however it was opened.
 *
 * A component of its own, drawn only where the port is, because it re-renders on every modal that
 * opens or closes: inside the shell it would take the list and the rail with it.
 */
export function KeyboardShortcutsCommand({ shortcuts }: { shortcuts: KeyboardShortcutsPort }) {
  const modals = useModals()
  const entries = useModalEntries()
  // The command arrives outside React, so it reads the latest of both through refs.
  const openId = useRef<string | null>(null)
  const latestEntries = useRef(entries)
  useEffect(() => {
    latestEntries.current = entries
  }, [entries])

  useEffect(
    () =>
      shortcuts.onOpenList(() => {
        // Showing on top, in its own panel or pushed onto settings from Help: back out of it.
        if (latestEntries.current.at(-1)?.stack.at(-1)?.id === KEYBOARD_SHORTCUTS_SCREEN) {
          modals.back()
          openId.current = null
          return
        }
        const open = openId.current
        if (open !== null && latestEntries.current.some((modal) => modal.id === open)) {
          modals.dismiss(open)
          openId.current = null
          return
        }
        openId.current = modals.present({
          fit: true,
          initial: {
            id: KEYBOARD_SHORTCUTS_SCREEN,
            title: tr('keyboardShortcuts'),
            render: () => <KeyboardShortcutsPage names={shortcuts.keyNames} />,
          },
        })
      }),
    [modals, shortcuts],
  )
  return null
}
