import { requirePorts, URLS, useNav, routes } from '@session/app'
import { tr, tStripped } from '@session/localization'
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
import { ConversationsPage } from './ConversationsPage'
import { HelpPage } from './HelpPage'
import { LocalizedText } from '../LocalizedText'

/**
 * How long Copy says it worked: iOS's four seconds, with the button held so a second press does
 * not look like a failure.
 */
const COPIED_FOR_MS = 4000

/**
 * Off the size scale on purpose: a brand badge sized to sit level with the row's icons. At 16 its
 * width crowds the label. Wider than the icon column, which it overhangs.
 */
const PRO_BADGE = 14.5

/** One row of the root list, as `SettingsRow` takes it. */
type RowSpec = Pick<
  SettingsRowProps,
  'label' | 'icon' | 'onPress' | 'accentIcon' | 'destructive'
> & {
  testID: string
}

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

/** "Your Account ID" in a pill between two rules. */
function AccountIdPill() {
  return (
    <XStack alignSelf="stretch" alignItems="center">
      <YStack flex={1} height={1} backgroundColor="$bordersColor" />
      <YStack
        paddingTop="$2xs"
        paddingBottom="$2xs"
        paddingHorizontal="$sm"
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
  // Which controls, by whether there is a share sheet rather than by the window: a tablet has the
  // wide layout and the phones' controls. See `SharePort`.
  const shareText = requirePorts().share.shareText

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
      {shareText === null ? (
        <DesktopCopy sessionId={sessionId} />
      ) : (
        <PhoneAccountActions sessionId={sessionId} shareText={shareText} />
      )}
    </YStack>
  )
}

/** Where there is no share sheet: copy alone. */
function DesktopCopy({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false)
  return (
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
  )
}

/**
 * Copy and Share under the ID, as both phone clients draw them.
 *
 * Share hands over the bare ID, as iOS does. Android's Share sends the invitation instead, which
 * is what Invite a Friend is for, so the two controls would otherwise do the same thing.
 */
function PhoneAccountActions({
  sessionId,
  shareText,
}: {
  sessionId: string
  shareText: (text: string) => Promise<void>
}) {
  const [copied, setCopied] = useState(false)
  return (
    <XStack gap="$sm">
      <Button
        variant="outline"
        size="sm"
        // Held while it says Copied, so the confirmation is not undone by a second press.
        disabled={copied}
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
      <Button
        variant="outline"
        size="sm"
        testID={ELEMENT.settings.shareAccountId}
        onPress={() => {
          void shareText(sessionId)
        }}
      >
        {tr('share')}
      </Button>
    </XStack>
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
  const shareText = requirePorts().share.shareText

  const row = ELEMENT.settings.row
  // Rows without `onPress` draw disabled: their screens are not built yet.
  const groups: RowSpec[][] = [
    [
      {
        label: tr('upgradeSession'),
        icon: <ProBadge size={PRO_BADGE} color="$textDisabled" />,
        testID: row('pro'),
      },
      // Phones only: without a share sheet there is nothing to send the invitation through.
      ...(shareText === null
        ? []
        : [
            {
              label: tr('sessionInviteAFriend'),
              icon: 'userRoundPlus',
              testID: row('invite'),
              onPress: () => {
                void shareText(tStripped('accountIdShare', { account_id: sessionId }))
              },
            } satisfies RowSpec,
          ]),
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
      {
        label: tr('sessionConversations'),
        icon: 'messageSquare',
        testID: row('conversations'),
        onPress: () => {
          modals.push({ title: tr('sessionConversations'), render: () => <ConversationsPage /> })
        },
      },
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
