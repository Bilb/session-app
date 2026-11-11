import { useEffect, useState } from 'react'
import { Modal as NativeModal } from 'react-native'
import { isWeb, YStack } from 'tamagui'

import { ContextMenu, type ContextMenuTestIDs } from './ContextMenu'
import type { ContextMenuEntry } from './contextMenuEntries'
import type { MenuAnchor } from './contextMenuPlacement'
import { ContextMenuTarget } from './ContextMenuTarget'
import { PressArea } from './PressArea'
import { QrCode } from './QrCode'
import { useWindowSize } from './useWindowSize'

/** The code's share of the window's shorter side, as the legacy desktop client sizes it. */
const WINDOW_SHARE = 0.75

export interface QrViewerMenu {
  entries: readonly ContextMenuEntry[]
  accessibilityLabel: string
  backLabel: string
  testIDs: ContextMenuTestIDs
}

export interface QrViewerProps {
  /** What the code holds; null while closed. */
  value: string | null
  onClose: () => void
  /** Names the code for a screen reader, and the press that closes it. */
  accessibilityLabel: string
  /** Opened on the code with a right-click or a long press; omitted where it offers nothing. */
  menu?: QrViewerMenu | undefined
  testID?: string | undefined
}

/**
 * A QR code filling most of the window, for a camera held at a distance: a press anywhere or
 * Escape closes it. No logo, unlike the code on the page, so nothing covers modules a distant or
 * blurry camera may need.
 */
export function QrViewer({ value, onClose, accessibilityLabel, menu, testID }: QrViewerProps) {
  const window = useWindowSize()
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)
  const sizePx = Math.floor(Math.min(window.width, window.height) * WINDOW_SHARE)
  const open = value !== null

  // Escape closes it on the desktop: react-native-web's Modal does not report Escape as a request
  // to close, which is what `onRequestClose` means on Android's back button. Left to the menu
  // while one is open, where Escape closes the menu first.
  useEffect(() => {
    if (!isWeb || !open || anchor !== null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [open, anchor, onClose])
  const code =
    value === null ? null : (
      <QrCode value={value} sizePx={sizePx} accessibilityLabel={accessibilityLabel} />
    )
  return (
    <NativeModal
      visible={value !== null}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <PressArea
        accessibilityLabel={accessibilityLabel}
        onPress={onClose}
        {...(testID === undefined ? {} : { testID })}
      >
        {() => (
          <YStack
            width={window.width}
            height={window.height}
            backgroundColor="$backgroundPrimary"
            alignItems="center"
            justifyContent="center"
          >
            {menu === undefined ? (
              code
            ) : (
              <ContextMenuTarget onOpen={setAnchor}>{code}</ContextMenuTarget>
            )}
          </YStack>
        )}
      </PressArea>
      {menu === undefined ? null : (
        <ContextMenu
          anchor={anchor}
          onDismiss={() => {
            setAnchor(null)
          }}
          entries={menu.entries}
          accessibilityLabel={menu.accessibilityLabel}
          backLabel={menu.backLabel}
          testIDs={menu.testIDs}
        />
      )}
    </NativeModal>
  )
}
