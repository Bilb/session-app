import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { useSessionActions, type RecoveryPassword } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import {
  Button,
  PressArea,
  QrCode,
  QrViewer,
  RecoveryPasswordMark,
  SettingsGroup,
  SettingsRow,
  Text,
  useModals,
  useWindowSize,
  XStack,
  YStack,
  type Modals,
} from '@session/ui'
import { useEffect, useState } from 'react'

import { LocalizedText } from '../LocalizedText'
import { RecoveryPasswordCopy } from './RecoveryPasswordCopy'

/** The shield beside the heading, at the clients' own size rather than a rung. */
const HEADING_MARK_SIZE = 20
/** The legacy desktop client's size for the code on the page; narrower on a narrow screen. */
const QR_SIZE_PX = 260
/** The card's padding and the page's, on both sides, which the code has to fit inside. */
const QR_INSET_PX = 64

/**
 * The second confirmation, with Cancel where the first had Continue, as the legacy iOS and desktop
 * clients put it: a second tap in the same place cancels rather than hiding for good.
 */
function confirmHideAgain(modals: Modals, hide: () => Promise<void>): void {
  const id = modals.present({
    kind: 'alert',
    testID: ELEMENT.recoveryPassword.hideConfirm,
    showClose: false,
    initial: {
      title: tr('recoveryPasswordHidePermanently'),
      render: () => (
        <LocalizedText
          text={tr('recoveryPasswordHidePermanentlyDescription2')}
          size="$body"
          textAlign="center"
        />
      ),
      footer: () => (
        <>
          <Button
            variant="ghost"
            fill
            borderRadius="$none"
            testID={ELEMENT.recoveryPassword.hideCancel}
            onPress={() => {
              modals.dismiss(id)
            }}
          >
            {tr('cancel')}
          </Button>
          <Button
            variant="ghost"
            fill
            borderRadius="$none"
            destructive
            testID={ELEMENT.recoveryPassword.hideYes}
            onPress={() => {
              modals.lock(id)
              void hide().finally(() => {
                modals.dismiss(id)
                // Back to Settings, where the row has gone, as every legacy client does.
                modals.pop()
              })
            }}
          >
            {tr('yes')}
          </Button>
        </>
      ),
    },
  })
}

function confirmHide(modals: Modals, hide: () => Promise<void>): void {
  const id = modals.present({
    kind: 'alert',
    testID: ELEMENT.recoveryPassword.hideConfirm,
    showClose: false,
    initial: {
      title: tr('recoveryPasswordHidePermanently'),
      render: () => (
        <LocalizedText
          text={tr('recoveryPasswordHidePermanentlyDescription1')}
          size="$body"
          textAlign="center"
        />
      ),
      footer: () => (
        <>
          <Button
            variant="ghost"
            fill
            borderRadius="$none"
            destructive
            testID={ELEMENT.recoveryPassword.hideContinue}
            onPress={() => {
              modals.dismiss(id)
              confirmHideAgain(modals, hide)
            }}
          >
            {tr('theContinue')}
          </Button>
          <Button
            variant="ghost"
            fill
            borderRadius="$none"
            testID={ELEMENT.recoveryPassword.hideCancel}
            onPress={() => {
              modals.dismiss(id)
            }}
          >
            {tr('cancel')}
          </Button>
        </>
      ),
    },
  })
}

/** The words as legacy draws them: monospaced, centred, in the accent's text colour, in a box. */
function Words({ words }: { words: string[] }) {
  return (
    <YStack
      borderWidth={1}
      borderColor="$separatorColor"
      borderRadius="$md"
      padding="$lg"
      alignSelf="stretch"
    >
      <Text
        size="$caption"
        fontFamily="$mono"
        color="$accentText"
        textAlign="center"
        selectable
        testID={ELEMENT.recoveryPassword.words}
      >
        {words.join(' ')}
      </Text>
    </YStack>
  )
}

/**
 * The recovery password: the words, or the QR code of the seed they encode, and hiding it for
 * good. A child screen; the settings modal supplies the chrome.
 *
 * The words and the seed are held here only, never in the store or a log: a string in JavaScript
 * cannot be wiped, so the fewer places hold one the better.
 */
export function RecoveryPasswordPage({
  initialView = 'words',
}: {
  /** Which the page opens on. The QR code is for the catalog, which has no press to get there. */
  initialView?: 'words' | 'qr' | undefined
} = {}) {
  // TODO: the legacy desktop client asks for the app password before showing this, where one is
  // set. There is no app password yet; ask for it here once there is.
  const actions = useSessionActions()
  const modals = useModals()
  const window = useWindowSize()
  const ports = requirePorts()
  const [secret, setSecret] = useState<RecoveryPassword | null>(null)
  const [failed, setFailed] = useState(false)
  const [showingQr, setShowingQr] = useState(initialView === 'qr')
  const [fullScreen, setFullScreen] = useState(false)

  useEffect(() => {
    let live = true
    actions.getRecoveryPassword().then(
      (loaded) => {
        if (live) setSecret(loaded)
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [actions])

  // Out of screenshots, recordings and the recents thumbnail while it is on screen, where the
  // platform offers that (Android).
  const preventCapture = ports.window.preventScreenCapture
  useEffect(() => {
    if (preventCapture === null) return
    preventCapture(true)
    return () => {
      preventCapture(false)
    }
  }, [preventCapture])

  // The desktop's full-screen code, and its Save, as the legacy desktop client offers them. Both
  // where a file can be saved, which is the desktop alone.
  const saveQrCode = ports.files.saveQrCode
  const qrSizePx = Math.min(QR_SIZE_PX, window.width - QR_INSET_PX)
  const qr =
    secret === null ? null : (
      <QrCode
        value={secret.seedHex}
        sizePx={qrSizePx}
        logo={RecoveryPasswordMark}
        accessibilityLabel={tr('qrCode')}
        testID={ELEMENT.recoveryPassword.qr}
      />
    )

  return (
    <YStack padding="$md" gap="$lg">
      <SettingsGroup>
        <YStack padding="$md" gap="$md" alignItems="center">
          <XStack alignSelf="stretch" alignItems="center" gap="$xs">
            <Text size="$heading" weight="bold">
              {tr('sessionRecoveryPassword')}
            </Text>
            <RecoveryPasswordMark size={HEADING_MARK_SIZE} color="$textPrimary" />
          </XStack>
          <LocalizedText
            text={tr('recoveryPasswordDescription')}
            size="$body"
            alignSelf="stretch"
          />

          {failed ? (
            <Text size="$body" color="$dangerColor" testID={ELEMENT.recoveryPassword.loadError}>
              {tr('recoveryPasswordErrorLoad')}
            </Text>
          ) : secret === null ? null : showingQr ? (
            <>
              {saveQrCode === null ? (
                qr
              ) : (
                <PressArea
                  accessibilityLabel={tr('qrCode')}
                  onPress={() => {
                    setFullScreen(true)
                  }}
                >
                  {() => qr}
                </PressArea>
              )}
              <XStack alignSelf="stretch">
                <Button
                  variant="outline"
                  fill
                  testID={ELEMENT.recoveryPassword.viewWords}
                  onPress={() => {
                    setShowingQr(false)
                  }}
                >
                  {tr('recoveryPasswordView')}
                </Button>
              </XStack>
            </>
          ) : (
            <>
              <Words words={secret.words} />
              <XStack alignSelf="stretch" gap="$md">
                <RecoveryPasswordCopy phrase={secret.words.join(' ')} />
                <Button
                  variant="outline"
                  fill
                  testID={ELEMENT.recoveryPassword.viewQr}
                  onPress={() => {
                    setShowingQr(true)
                  }}
                >
                  {tr('qrView')}
                </Button>
              </XStack>
            </>
          )}
        </YStack>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          label={tr('recoveryPasswordHideRecoveryPassword')}
          subtitle={tr('recoveryPasswordHideRecoveryPasswordDescription')}
          testID={ELEMENT.recoveryPassword.hideRow}
          wideTrailing
          trailing={
            <Button
              variant="danger"
              size="sm"
              testID={ELEMENT.recoveryPassword.hide}
              onPress={() => {
                confirmHide(modals, actions.hideRecoveryPassword)
              }}
            >
              {tr('hide')}
            </Button>
          }
        />
      </SettingsGroup>

      {saveQrCode === null ? null : (
        <QrViewer
          value={fullScreen && secret !== null ? secret.seedHex : null}
          onClose={() => {
            setFullScreen(false)
          }}
          accessibilityLabel={tr('qrCode')}
          testID={ELEMENT.recoveryPassword.qrFullScreen}
          menu={{
            entries: [
              {
                id: 'save',
                kind: 'action',
                label: tr('save'),
                icon: 'download',
                testID: ELEMENT.contextMenu.item('save'),
                onSelect: () => {
                  if (secret !== null) void saveQrCode(secret.seedHex)
                },
              },
            ],
            accessibilityLabel: tr('qrCode'),
            backLabel: tr('back'),
            testIDs: ELEMENT.contextMenu,
          }}
        />
      )}
    </YStack>
  )
}
