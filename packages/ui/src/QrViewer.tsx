import { useState } from 'react'
import { Modal as NativeModal } from 'react-native'
import { YStack } from 'tamagui'

import { Button } from './Button'
import { ContextMenu, type ContextMenuTestIDs } from './ContextMenu'
import type { ContextMenuEntry } from './contextMenuEntries'
import type { MenuAnchor } from './contextMenuPlacement'
import { ContextMenuTarget } from './ContextMenuTarget'
import { Icon } from './Icon'
import type { IconName } from './Icon.types'
import { PressArea } from './PressArea'
import { QrCode } from './QrCode'
import { useScreenInsets } from './screenInsets'
import { useWindowSize } from './useWindowSize'

/** The code's share of the window's shorter side. */
const WINDOW_SHARE = 0.75

export interface QrViewerMenu {
  entries: readonly ContextMenuEntry[]
  accessibilityLabel: string
  backLabel: string
  testIDs: ContextMenuTestIDs
}

/** A button under the code, for what a long press or right-click on it would otherwise hide. */
export interface QrViewerAction {
  label: string
  icon: IconName
  onPress: () => void
  testID?: string | undefined
}

export interface QrViewerProps {
  /** What the code holds; null while closed. */
  value: string | null
  onClose: () => void
  /** Names the code for a screen reader, and the press that closes it. */
  accessibilityLabel: string
  /** Opened on the code with a right-click or a long press; omitted where it offers nothing. */
  menu?: QrViewerMenu | undefined
  action?: QrViewerAction | undefined
  testID?: string | undefined
}

export interface QrViewerBodyProps {
  value: string
  width: number
  height: number
  /** What the hardware takes from the bottom of the window, so the action clears it. */
  bottomInsetPx: number
  onClose: () => void
  accessibilityLabel: string
  /** Where a right-click or long press on the code opens the menu; omitted where there is none. */
  onMenu?: ((anchor: MenuAnchor) => void) | undefined
  action?: QrViewerAction | undefined
  testID?: string | undefined
}

/**
 * What the viewer draws, at a given size: apart from its modal so the catalog can draw it.
 *
 * The action sits beside the press area rather than inside it: on the web a click inside would
 * reach the press area too, and close the viewer as it acted.
 */
export function QrViewerBody({
  value,
  width,
  height,
  bottomInsetPx,
  onClose,
  accessibilityLabel,
  onMenu,
  action,
  testID,
}: QrViewerBodyProps) {
  const sizePx = Math.floor(Math.min(width, height) * WINDOW_SHARE)
  const code = <QrCode value={value} sizePx={sizePx} accessibilityLabel={accessibilityLabel} />
  return (
    <YStack width={width} height={height} position="relative" alignItems="center">
      <PressArea
        accessibilityLabel={accessibilityLabel}
        onPress={onClose}
        {...(testID === undefined ? {} : { testID })}
      >
        {() => (
          <YStack
            width={width}
            height={height}
            backgroundColor="$backgroundPrimary"
            alignItems="center"
            justifyContent="center"
          >
            {onMenu === undefined ? (
              code
            ) : (
              <ContextMenuTarget onOpen={onMenu}>{code}</ContextMenuTarget>
            )}
          </YStack>
        )}
      </PressArea>
      {action === undefined ? null : (
        // Only as wide as the button, centred by the parent, so a press beside it still closes.
        <YStack position="absolute" bottom={bottomInsetPx} padding="$lg">
          <Button
            variant="outlineAccent"
            {...(action.testID === undefined ? {} : { testID: action.testID })}
            onPress={action.onPress}
            icon={<Icon name={action.icon} size="md" color="$primaryColor" />}
          >
            {action.label}
          </Button>
        </YStack>
      )}
    </YStack>
  )
}

/**
 * A QR code filling most of the window, for a camera held at a distance: a press anywhere but the
 * action, or Escape, closes it. No logo, unlike the code on the page, so nothing covers modules a
 * distant or blurry camera may need. Escape is the platform modal's own `onRequestClose`, as for
 * the host.
 */
export function QrViewer({
  value,
  onClose,
  accessibilityLabel,
  menu,
  action,
  testID,
}: QrViewerProps) {
  const window = useWindowSize()
  const insets = useScreenInsets()
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)

  return (
    <NativeModal
      visible={value !== null}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      {value === null ? null : (
        <QrViewerBody
          value={value}
          width={window.width}
          height={window.height}
          bottomInsetPx={insets.bottom}
          onClose={onClose}
          accessibilityLabel={accessibilityLabel}
          onMenu={menu === undefined ? undefined : setAnchor}
          action={action}
          testID={testID}
        />
      )}
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
