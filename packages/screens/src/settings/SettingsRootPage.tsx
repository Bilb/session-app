import { requirePorts, URLS, useNav, routes } from '@session/app'
import { tr } from '@session/localization'
import { useAccount, useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import {
  Avatar,
  Button,
  ProBadge,
  RecoveryPasswordShield,
  SessionTokenMark,
  SettingsGroup,
  SettingsRow,
  Text,
  useModals,
  XStack,
  YStack,
  type SettingsRowProps,
  type Modals,
} from '@session/ui'
import { useState } from 'react'

import { accountIdLines } from './accountIdLines'
import { confirmLink } from './confirmLink'
import { HelpPage } from './HelpPage'
import { LocalizedText } from '../LocalizedText'

/** How long the copy control shows that it worked. */
const COPIED_FOR_MS = 2000

/** iOS's `.small` badge, 32 by 14.5: it overhangs the icon column, as the clients' badges do. */
const PRO_BADGE = 14.5

/** One row of the root list, as `SettingsRow` takes it. */
type RowSpec = Pick<
  SettingsRowProps,
  'label' | 'icon' | 'onPress' | 'accentIcon' | 'destructive'
> & {
  testID: string
}

/** The avatar at the top: the desktop client's `AvatarSize.XL`. */
const PROFILE_AVATAR = 90

/** Asks before deleting everything on the device, on top of the settings modal. */
function confirmClearData(modals: Modals, clear: () => Promise<void>): void {
  const id = modals.present({
    kind: 'alert',
    testID: ELEMENT.settings.confirmClearData,
    // No cross: somebody deciding whether to erase their account should read the word Cancel.
    // The scrim and Escape still leave, as on desktop.
    showClose: false,
    initial: {
      title: tr('clearDataAll'),
      render: () => (
        <LocalizedText text={tr('clearDeviceDescription')} size="$body" textAlign="center" />
      ),
      footer: () => <ClearDataActions modals={modals} id={id} clear={clear} />,
    },
  })
}

/** Locked while the clear runs, so nothing can look like a cancel of what is already happening. */
function ClearDataActions({
  modals,
  id,
  clear,
}: {
  modals: Modals
  id: string
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
        testID={ELEMENT.settings.confirmClearDataButton}
        onPress={() => {
          setRunning(true)
          modals.lock(id)
          void clear().finally(() => {
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
        testID={ELEMENT.settings.cancelClearData}
        onPress={() => {
          modals.dismiss(id)
        }}
      >
        {tr('cancel')}
      </Button>
    </>
  )
}

/** The client's measurements, off the scale on purpose: rounded onto rungs it reads as a button. */
const PILL_PADDING = { top: 6, bottom: 5, side: 15 } as const

/** "Your Account ID" in a pill between two rules: the desktop client's `AccountIdPill`. */
function AccountIdPill() {
  return (
    <XStack alignSelf="stretch" alignItems="center">
      <YStack flex={1} height={1} backgroundColor="$bordersColor" />
      <YStack
        paddingTop={PILL_PADDING.top}
        paddingBottom={PILL_PADDING.bottom}
        paddingHorizontal={PILL_PADDING.side}
        borderRadius="$full"
        borderWidth={1}
        borderColor="$bordersColor"
      >
        <Text size="$body" tone="secondary" userSelect="none">
          {tr('accountIdYours')}
        </Text>
      </YStack>
      <YStack flex={1} height={1} backgroundColor="$bordersColor" />
    </XStack>
  )
}

/**
 * The account, above the rows. The ID is what someone needs to message this account, so it wraps
 * rather than truncates and gets a copy control rather than being tappable text.
 */
function AccountHeader({ sessionId, name }: { sessionId: string; name: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <YStack alignItems="center" gap="$sm" paddingVertical="$lg">
      <Avatar id={sessionId} name={name} size={PROFILE_AVATAR} />
      {name === '' ? null : (
        <Text size="$headingLarge" weight="bold" testID={ELEMENT.settings.displayName}>
          {name}
        </Text>
      )}
      <AccountIdPill />
      {/* One element per line, so the text engine cannot move the breaks. */}
      <YStack alignItems="center" testID={ELEMENT.settings.accountId}>
        {accountIdLines(sessionId).map((line, at) => (
          // Keyed by position: lines can repeat (the fake's IDs are runs of zeroes), and duplicate
          // keys crash on iOS.
          <Text key={at} size="$bodyLarge" fontFamily="$mono">
            {line}
          </Text>
        ))}
      </YStack>
      <Button
        variant="outline"
        size="sm"
        testID={ELEMENT.settings.copyAccountId}
        onPress={() => {
          void requirePorts()
            .clipboard.setString(sessionId)
            .then(() => {
              setCopied(true)
              setTimeout(() => {
                setCopied(false)
              }, COPIED_FOR_MS)
            })
        }}
      >
        {copied ? tr('copied') : tr('copy')}
      </Button>
    </YStack>
  )
}

/**
 * The landing screen of the settings modal: the account, then five unheaded groups of rows.
 *
 * Child screens are pushed onto this modal rather than opening their own, so back returns here.
 * A disabled row is one whose screen is not built yet.
 */
export function SettingsRootPage() {
  const account = useAccount()
  const actions = useSessionActions()
  const modals = useModals()
  const nav = useNav()

  // No fallback: without an account there is no honest ID to show, so the caller is at fault.
  if (account?.sessionId === undefined)
    throw new Error('SettingsRootPage: no account. Onboarding has to run before this opens.')

  const sessionId = account.sessionId
  const name = account.displayName ?? ''

  const row = ELEMENT.settings.row
  // Rows without `onPress` draw disabled: their screens are not built yet.
  const groups: RowSpec[][] = [
    [
      {
        label: tr('upgradeSession'),
        icon: <ProBadge size={PRO_BADGE} color="$textDisabled" />,
        testID: row('pro'),
      },
    ],
    [
      {
        label: tr('donate'),
        icon: 'heart',
        accentIcon: true,
        testID: row('donate'),
        onPress: () => {
          confirmLink(modals, URLS.donationsApp)
        },
      },
      // The live onion-path icon and path modal both wait on the path screen.
      { label: tr('onionRoutingPath'), icon: 'info', testID: row('onion-path') },
      { label: tr('networkName'), icon: SessionTokenMark, testID: row('network') },
    ],
    [
      { label: tr('sessionPrivacy'), icon: 'lockKeyhole', testID: row('privacy') },
      { label: tr('sessionNotifications'), icon: 'volume', testID: row('notifications') },
      { label: tr('sessionConversations'), icon: 'messageSquare', testID: row('conversations') },
      { label: tr('sessionAppearance'), icon: 'paintbrush', testID: row('appearance') },
      {
        label: tr('sessionMessageRequests'),
        icon: 'messageSquareWarning',
        testID: row('message-requests'),
        // Leaves rather than descends: the requests list is a route of its own.
        onPress: () => {
          modals.dismissAll()
          nav.push(routes.requests())
        },
      },
      { label: tr('preferences'), icon: 'settings', testID: row('preferences') },
    ],
    [
      {
        label: tr('sessionRecoveryPassword'),
        icon: RecoveryPasswordShield,
        testID: row('recovery-password'),
      },
      {
        label: tr('sessionHelp'),
        icon: 'circleHelp',
        testID: row('help'),
        onPress: () => {
          modals.push({ title: tr('sessionHelp'), render: () => <HelpPage /> })
        },
      },
      {
        label: tr('sessionClearData'),
        icon: 'trash',
        destructive: true,
        testID: ELEMENT.settings.clearData,
        onPress: () => {
          confirmClearData(modals, () => actions.clearDeviceData())
        },
      },
    ],
  ]

  return (
    <YStack paddingHorizontal="$md" paddingBottom="$md" gap="$lg">
      <AccountHeader sessionId={sessionId} name={name} />
      {groups.map((rows) => (
        <SettingsGroup key={rows[0]?.testID}>
          {rows.map((spec) => (
            <SettingsRow key={spec.testID} {...spec} disabled={spec.onPress === undefined} />
          ))}
        </SettingsGroup>
      ))}
    </YStack>
  )
}

/** Opens settings over whatever is on screen. */
export function useOpenSettings(): () => void {
  const modals = useModals()
  return () => {
    modals.present({
      initial: { title: tr('sessionSettings'), render: () => <SettingsRootPage /> },
    })
  }
}
