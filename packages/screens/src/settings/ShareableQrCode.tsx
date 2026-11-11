import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import {
  ContextMenu,
  ContextMenuTarget,
  PressArea,
  QrCode,
  QrViewer,
  type MenuAnchor,
  type QrCodeProps,
} from '@session/ui'
import { useState } from 'react'

type ShareableQrCodeProps = Pick<
  QrCodeProps,
  'value' | 'sizePx' | 'logo' | 'accessibilityLabel' | 'testID'
> & {
  fullScreenTestID: string
}

/**
 * A QR code with what each platform can do with it, as the legacy clients offer: on desktop a
 * press opens it full screen, where a right-click saves it; on the phones a long press opens the
 * share sheet, from which it can be saved to Files. A platform with neither draws the code alone.
 *
 * The menu and the full-screen viewer are platform modals, so where this sits in a layout places
 * only the code.
 */
export function ShareableQrCode({
  value,
  sizePx,
  logo,
  accessibilityLabel,
  testID,
  fullScreenTestID,
}: ShareableQrCodeProps) {
  const ports = requirePorts()
  const saveQrCode = ports.files.saveQrCode
  const shareQrCode = ports.share.shareQrCode
  const [shareMenu, setShareMenu] = useState<MenuAnchor | null>(null)
  const [fullScreen, setFullScreen] = useState(false)

  const qr = (
    <QrCode
      value={value}
      sizePx={sizePx}
      logo={logo}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  )

  if (saveQrCode !== null)
    return (
      <>
        <PressArea
          accessibilityLabel={accessibilityLabel}
          onPress={() => {
            setFullScreen(true)
          }}
        >
          {() => qr}
        </PressArea>
        <QrViewer
          value={fullScreen ? value : null}
          onClose={() => {
            setFullScreen(false)
          }}
          accessibilityLabel={accessibilityLabel}
          testID={fullScreenTestID}
          menu={{
            entries: [
              {
                id: 'save',
                kind: 'action',
                label: tr('save'),
                icon: 'download',
                testID: ELEMENT.contextMenu.item('save'),
                onSelect: () => {
                  void saveQrCode(value)
                },
              },
            ],
            accessibilityLabel,
            backLabel: tr('back'),
            testIDs: ELEMENT.contextMenu,
          }}
        />
      </>
    )

  if (shareQrCode === null) return qr

  return (
    <>
      <ContextMenuTarget onOpen={setShareMenu}>{qr}</ContextMenuTarget>
      <ContextMenu
        anchor={shareMenu}
        onDismiss={() => {
          setShareMenu(null)
        }}
        entries={[
          {
            id: 'share',
            kind: 'action',
            label: tr('share'),
            icon: 'share2',
            testID: ELEMENT.contextMenu.item('share'),
            onSelect: () => {
              void shareQrCode(value)
            },
          },
        ]}
        accessibilityLabel={accessibilityLabel}
        backLabel={tr('back')}
        testIDs={ELEMENT.contextMenu}
      />
    </>
  )
}
