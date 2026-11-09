import { appLog, requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { isClearable, useAccount, useSessionActions, type StartupFailureKind } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Screen, Text, useModals, XStack, YStack, type Modals } from '@session/ui'
import { useState } from 'react'

import { clearAfterStartupFailure } from './endAfterClear'
import { LocalizedText } from './LocalizedText'
import { TextButton } from './TextButton'
import { useCopyWithToast } from './useCopyWithToast'
import { useExportLogs } from './useExportLogs'

interface StartupFailedScreenProps {
  /** libsession's own words: the only thing on the screen that says which failure it was. */
  error: string
  /** What the explanation says, and whether there is anything to clear with. */
  kind: StartupFailureKind
}

/**
 * The explanation for each kind.
 *
 * Every database failure is told to restart, an unreadable one included, as the current clients
 * now say. The generic database error says to reinstall and restore, and a reinstall deletes the
 * database: for a failure a restart would have got past -- a keychain that reported an existing
 * key as missing -- that loses the account. Where a restart cannot help, Clear Device is offered,
 * and its confirmation says the Recovery Password is the only way back. Telling anyone to restart
 * is only true because Quit ends the process on every platform, macOS included. With no bridge
 * nothing was opened, so it is not a database error.
 */
function explanation(kind: StartupFailureKind): string {
  switch (kind) {
    case 'unreadable':
    case 'transient':
      return tr('shareExtensionDatabaseError')
    case 'noBridge':
      return tr('errorUnknown')
  }
}

/**
 * Every press on this screen, at critical: the screen is reached only when something is badly
 * wrong, and which way out somebody took is what support asks first. The kind, never the reason,
 * which is logged once by the start-failed marker and may name paths.
 */
function logPress(control: string, kind: StartupFailureKind): void {
  appLog.critical('startup', `pressed ${control}`, { kind })
}

/**
 * The app could not start.
 *
 * **The second outcome of a launch.** Without it, a rejection between the app opening and
 * libsession answering is indistinguishable from a database still migrating: the launch screen
 * stays up and neither ever ends. Drawn in the default theme, which is what the launch screen was
 * drawn in -- the theme is a preference in the database that just failed to open.
 *
 * **Clearing is the only fix the screen performs**, for a failure no restart gets past. It leads to
 * onboarding (through a relaunch if an account had been loaded: see `clearAfterStartupFailure`),
 * where somebody either starts again or enters their recovery phrase. The explanation tells every
 * database failure to restart first, which Quit makes possible by ending the process. No Retry:
 * what lands here is a request the open database refused, and asking it again in the same process
 * gets the same answer. Where the bridge itself could not be made, for any reason but its key,
 * there is nothing to clear with, and Quit is all that is left.
 */
export function StartupFailedScreen({ error, kind }: StartupFailedScreenProps) {
  const actions = useSessionActions()
  const modals = useModals()
  const close = requirePorts().window.close
  const logs = useExportLogs()
  const clearable = isClearable(kind)
  const accountLoaded = useAccount()?.haveAccount === true

  return (
    <Screen padded testID={ELEMENT.startupFailed.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$xl">
        <YStack maxWidth={420} gap="$md" alignItems="center">
          <Text size="$titleLarge" weight="bold" textAlign="center">
            {tr('theError')}
          </Text>
          <LocalizedText
            text={explanation(kind)}
            textAlign="center"
            testID={ELEMENT.startupFailed.explanation}
          />
          <FailureReason error={error} kind={kind} />
        </YStack>

        <YStack gap="$sm" width="100%" maxWidth={348}>
          {/* What the explanation above asks for. A spinner, and inert, while the export runs:
              seconds of native compression on a phone, then the share sheet. Left out where the
              build cannot export. */}
          {logs.canExport ? (
            <TextButton
              label={['helpReportABugExportLogs']}
              variant="outline"
              loading={logs.exporting}
              testID={ELEMENT.startupFailed.exportLogs}
              onPress={() => {
                logPress('export logs', kind)
                logs.start()
              }}
            />
          ) : null}
          {/* Not where there is no bridge to clear with: a Clear that is known to fail is a
              destructive-looking button that does nothing. A missing or unreadable key has one:
              its clear deletes the database the key belonged to and makes a new key. */}
          {clearable ? (
            <TextButton
              label={['clearDevice']}
              variant="danger"
              testID={ELEMENT.startupFailed.clear}
              onPress={() => {
                logPress('clear device', kind)
                confirmClear(modals, kind, () =>
                  clearAfterStartupFailure(() => actions.clearDeviceData(), accountLoaded),
                )
              }}
            />
          ) : null}
          {close === null ? null : (
            <TextButton
              label={['quit']}
              variant="outline"
              testID={ELEMENT.startupFailed.quit}
              onPress={() => {
                // Before the close, which writes out what is waiting on every platform.
                logPress('quit', kind)
                close()
              }}
            />
          )}
        </YStack>
      </YStack>
    </Screen>
  )
}

/**
 * libsession's message, apart from the explanation and drawn quieter, with a control that copies
 * it. It is the only thing on this screen that differs between one failure and another, and it is
 * what support needs.
 */
function FailureReason({ error, kind }: { error: string; kind: StartupFailureKind }) {
  const copyWithToast = useCopyWithToast()
  const copy = () => {
    logPress('copy reason', kind)
    copyWithToast(error)
  }
  return (
    <XStack alignItems="center" gap="$xs">
      <Text
        flexShrink={1}
        tone="secondary"
        size="$caption"
        textAlign="center"
        testID={ELEMENT.startupFailed.reason}
      >
        {error}
      </Text>
      <Button
        variant="ghost"
        size="xs"
        circular
        accessibilityLabel={tr('copy')}
        testID={ELEMENT.startupFailed.copyReason}
        onPress={copy}
        icon={<Icon name="copy" size="sm" color="$textSecondary" />}
      />
    </XStack>
  )
}

/**
 * Asks before clearing, as every other destructive confirmation does: Clear beside Cancel, under
 * what is about to be lost and the one thing that can bring the account back.
 */
function confirmClear(modals: Modals, kind: StartupFailureKind, clear: () => Promise<void>): void {
  const id = modals.present({
    kind: 'alert',
    testID: ELEMENT.startupFailed.confirmClear,
    // No cross: somebody deciding whether to erase their account should read the word Cancel.
    showClose: false,
    initial: {
      title: tr('clearDevice'),
      render: () => (
        <LocalizedText
          text={tr('databaseErrorClearDeviceWarning')}
          size="$body"
          textAlign="center"
        />
      ),
      footer: () => <ClearActions modals={modals} id={id} kind={kind} clear={clear} />,
    },
  })
}

/** Locked while the clear runs, so nothing can look like a cancel of what is already happening. */
function ClearActions({
  modals,
  id,
  kind,
  clear,
}: {
  modals: Modals
  id: string
  kind: StartupFailureKind
  clear: () => Promise<void>
}) {
  const [running, setRunning] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        fill
        borderRadius="$none"
        destructive
        disabled={running}
        testID={ELEMENT.startupFailed.confirmClearButton}
        onPress={() => {
          logPress('confirm clear', kind)
          setRunning(true)
          modals.lock(id)
          // A failure is shown by the screen itself: the store sets it as the reason.
          void clear()
            .catch(() => {})
            .finally(() => {
              modals.dismissAll()
            })
        }}
      >
        {tr('clear')}
      </Button>
      <Button
        variant="ghost"
        fill
        borderRadius="$none"
        disabled={running}
        testID={ELEMENT.startupFailed.cancelClear}
        onPress={() => {
          logPress('cancel clear', kind)
          modals.dismiss(id)
        }}
      >
        {tr('cancel')}
      </Button>
    </>
  )
}
