import { requirePorts, URLS, useNav, routes } from '@session/app'
import { tr } from '@session/localization'
import { useAccount, useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import {
  Avatar,
  Button,
  offScaleText,
  RecoveryPasswordShield,
  SessionTokenMark,
  SettingsGroup,
  SettingsRow,
  Text,
  useModals,
  XStack,
  YStack,
  type IconName,
  type MarkProps,
  type Modals,
} from '@session/ui'
import { useState, type ComponentType } from 'react'

import { accountIdLines } from './accountIdLines'
import { confirmLink } from './confirmLink'
import { HelpPage } from './HelpPage'
import { LocalizedText } from '../LocalizedText'

/** How long the copy control says it worked before going back to offering to do it again. */
const COPIED_FOR_MS = 2000

/** The avatar at the top: the desktop client's `AvatarSize.XL`. */
const PROFILE_AVATAR = 90

/** Asks before deleting everything on the device, on top of the settings modal. */
function confirmClearData(modals: Modals, clear: () => Promise<void>): void {
  const id = modals.present({
    kind: 'alert',
    testID: ELEMENT.settings.confirmClearData,
    // Left from the scrim or Escape, as the desktop client's is, but with no cross: there are two
    // answers in the footer, and somebody deciding whether to erase their account wants to read
    // the word Cancel rather than infer it from a glyph.
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

/**
 * The confirm's two answers, which hold still once Clear is pressed.
 *
 * Both are disabled and the alert stops being dismissible while the clear runs, so nothing can
 * look like a cancel of something that is already happening.
 */
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

/**
 * The client's own measurements for the pill, which sit on neither scale: a line of caption text
 * in 6 above, 5 below and 15 either side. Rounded onto rungs the pill reads as a button.
 */
const PILL_PADDING = { top: 6, bottom: 5, side: 15 } as const

/** The pill's text, which the client leaves at its modal body's 15 -- between the ramp's 14 and 16. */
const PILL_TEXT = 15

/**
 * "Your Account ID", in a pill with a rule running out from each side of it.
 *
 * The desktop client's `AccountIdPill`: it heads the ID as a label, and the rules are what separate
 * the account block from the name above it without a divider of its own.
 */
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
        <Text {...offScaleText(PILL_TEXT)} tone="secondary" userSelect="none">
          {tr('accountIdYours')}
        </Text>
      </YStack>
      <YStack flex={1} height={1} backgroundColor="$bordersColor" />
    </XStack>
  )
}

/**
 * The account, above the rows.
 *
 * The account ID is the one piece of state a person has to be able to read off the screen -- it is
 * what somebody else needs in order to write to this device -- so it wraps rather than truncates
 * and has a control of its own rather than being tappable text.
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
      {/* One element per line, so the break is where it was put rather than wherever the text
          engine found room. See `accountIdLines`. */}
      <YStack alignItems="center" testID={ELEMENT.settings.accountId}>
        {accountIdLines(sessionId).map((line, at) => (
          // By position, not by content: an ID's lines can repeat -- a fake account's are runs of
          // zeroes -- and two siblings with one key is a warning on the web and a crash on iOS.
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
 * The landing screen of the settings modal: the account, then four groups of rows.
 *
 * **A disabled row is one whose screen is not built yet**, and most of them are: the
 * settings tree arrives one screen per change. They are drawn anyway, because the order of the
 * list is the design -- a list that grows a row in the middle later is a different list from the
 * one that was reviewed.
 *
 * **The grouping carries the whole structure**, because the client's root page has no headings at
 * all -- only the gaps between blocks say which rows belong together.
 *
 * Every row that leads to a child screen pushes it onto this modal rather than opening one of its
 * own, so the back control returns here. The two that are not screens behave as the client's do: a
 * link leaves through a confirmation, and clearing data asks on top of this.
 */
export function SettingsRootPage() {
  const account = useAccount()
  const actions = useSessionActions()
  const modals = useModals()
  const nav = useNav()

  // Not a fallback string, because there is no honest one. This screen exists to hand somebody
  // their account ID; with no account there is nothing to show and no reason to be here, and
  // whatever opened it has gone wrong upstream.
  if (account?.sessionId === undefined)
    throw new Error('SettingsRootPage: no account. Onboarding has to run before this opens.')

  const sessionId = account.sessionId
  const name = account.displayName ?? ''

  /**
   * Each row's glyph: the client's own artwork where it draws one, and otherwise the client's choice
   * wherever our set has the same one.
   */
  const icon = {
    donate: 'heart',
    path: 'info',
    network: SessionTokenMark,
    privacy: 'lockKeyhole',
    notifications: 'volume',
    conversations: 'messageSquare',
    appearance: 'paintbrush',
    requests: 'messageSquareWarning',
    preferences: 'settings',
    recovery: RecoveryPasswordShield,
    help: 'circleHelp',
    clear: 'trash',
  } satisfies Record<string, IconName | ComponentType<MarkProps>>

  return (
    <YStack paddingHorizontal="$md" paddingBottom="$md" gap="$lg">
      <AccountHeader sessionId={sessionId} name={name} />

      <SettingsGroup>
        <SettingsRow
          label={tr('donate')}
          icon={icon.donate}
          accentIcon
          testID={ELEMENT.settings.row('donate')}
          onPress={() => {
            confirmLink(modals, URLS.donationsApp)
          }}
        />
        {/* The client draws a live onion-path indicator as this row's icon and opens the path in a
            modal of its own. Both wait on the path screen. */}
        <SettingsRow
          label={tr('onionRoutingPath')}
          icon={icon.path}
          disabled
          testID={ELEMENT.settings.row('onion-path')}
        />
        <SettingsRow
          label={tr('networkName')}
          icon={icon.network}
          disabled
          testID={ELEMENT.settings.row('network')}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          label={tr('sessionPrivacy')}
          icon={icon.privacy}
          disabled
          testID={ELEMENT.settings.row('privacy')}
        />
        <SettingsRow
          label={tr('sessionNotifications')}
          icon={icon.notifications}
          disabled
          testID={ELEMENT.settings.row('notifications')}
        />
        <SettingsRow
          label={tr('sessionConversations')}
          icon={icon.conversations}
          disabled
          testID={ELEMENT.settings.row('conversations')}
        />
        <SettingsRow
          label={tr('sessionAppearance')}
          icon={icon.appearance}
          disabled
          testID={ELEMENT.settings.row('appearance')}
        />
        {/* Not a child screen in the client either: it closes the modal and shows the requests
            list, which here is a route of its own. So this one leaves rather than descends. */}
        <SettingsRow
          label={tr('sessionMessageRequests')}
          icon={icon.requests}
          testID={ELEMENT.settings.row('message-requests')}
          onPress={() => {
            modals.dismissAll()
            nav.push(routes.requests())
          }}
        />
        <SettingsRow
          label={tr('preferences')}
          icon={icon.preferences}
          disabled
          testID={ELEMENT.settings.row('preferences')}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          label={tr('sessionRecoveryPassword')}
          icon={icon.recovery}
          disabled
          testID={ELEMENT.settings.row('recovery-password')}
        />
        <SettingsRow
          label={tr('sessionHelp')}
          icon={icon.help}
          testID={ELEMENT.settings.row('help')}
          onPress={() => {
            modals.push({ title: tr('sessionHelp'), render: () => <HelpPage /> })
          }}
        />
        <SettingsRow
          label={tr('sessionClearData')}
          icon={icon.clear}
          destructive
          testID={ELEMENT.settings.clearData}
          onPress={() => {
            confirmClearData(modals, () => actions.clearDeviceData())
          }}
        />
      </SettingsGroup>
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
