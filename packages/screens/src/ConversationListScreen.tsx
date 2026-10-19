import { routes, useNav } from '@session/app'
import type { Conversation } from '@session/client'
import { useConversations, useUnreadRequestCount } from '@session/state'
import { formatConversationTime, tr, type ConversationTimeOptions } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Avatar, Icon, List, logical, Screen, Separator, Text, XStack, YStack } from '@session/ui'

import { NetworkOverlay } from './NetworkOverlay'
import { conversationRowState, type UnreadBadge, type UnreadTone } from './conversationRowState'
import { conversationTitle } from './conversationTitle'
import { useOpenSettings } from './settings/SettingsRootPage'
import { useTopBarInsets } from './shell/pane'
import { SYSTEM_LOCALE, useLocaleChoice } from './useLocale'

/**
 * The height of one row, which the list needs in order to place a scrollbar without measuring.
 *
 * The design's 72: the avatar, size `3xl` (48) and the tallest thing in the row, with the `sm` gap
 * (12) above and below. A number rather than a token because the list places rows with it before
 * any are laid out. Both text lines are `numberOfLines={1}`, so nothing here can wrap and change
 * it; `ConversationRow` is the only place that could, which is why the constant lives beside it.
 */
const ROW_HEIGHT_PX = 72
const AVATAR_SIZE = '3xl'
/**
 * Each line is this tall whatever it holds, so a row with a pill lines up with one without. The
 * kind glyph's disc and the pill a count sits in are the same height, so neither moves the line.
 */
const LINE_HEIGHT = '$md'
/**
 * Takes no width, so a row's contents sit in the same place unread or not. A number because the
 * size ladder stops at 8: a `$2xs` width would resolve against it and draw nothing.
 */
const STRIP_WIDTH_PX = 4
/** The accent dot on the marked-unread envelope. */
const MARKED_DOT = '$xxs'
/** The least room between the end of the name's icons and the time. */
const TIME_GAP_MIN = '$xxs'

/**
 * The conversation list.
 *
 * It reads the store and navigates through the port, so it is the same screen on a phone,
 * in a tablet's left pane and in the desktop window. Which of those it is showing in is
 * AdaptiveShell's business, not its own.
 */
export function ConversationListScreen({
  openConversationId,
}: {
  /** The conversation showing beside the list, where one is: its row is drawn selected. */
  openConversationId?: string | undefined
}) {
  const topBarInsets = useTopBarInsets()
  const conversations = useConversations()
  const unreadRequests = useUnreadRequestCount()
  const nav = useNav()
  const openSettings = useOpenSettings()
  const localeChoice = useLocaleChoice()
  // Following the system leaves the locale to the runtime, which knows the device's region as well
  // as its language; a language picked here says nothing about region, so it is passed as it is.
  const timeLocale = localeChoice === SYSTEM_LOCALE ? undefined : localeChoice

  return (
    <Screen testID={ELEMENT.conversationList.screen}>
      <XStack
        paddingHorizontal="$md"
        paddingVertical="$sm"
        alignItems="center"
        justifyContent="space-between"
        {...topBarInsets}
      >
        <NetworkOverlay>
          <Text size="$title" weight="bold">
            {tr('messages')}
          </Text>
        </NetworkOverlay>
        <XStack alignItems="center" gap="$sm">
          {unreadRequests > 0 ? (
            <XStack
              backgroundColor="$primaryColor"
              borderRadius="$full"
              paddingHorizontal="$xs"
              minWidth={20}
              height={20}
              alignItems="center"
              justifyContent="center"
              testID={ELEMENT.requests.badge}
              onPress={() => nav.push(routes.requests())}
            >
              <Text size="$caption" weight="bold" color="$onAccent">
                {unreadRequests}
              </Text>
            </XStack>
          ) : null}

          {/* Writing to somebody who has not written first was impossible before this: the
              only way into a conversation was replying to a request. */}
          <XStack
            width={44}
            height={44}
            alignItems="center"
            justifyContent="center"
            $platform-web={{ cursor: 'pointer' }}
            hoverStyle={{ backgroundColor: '$backgroundSecondary' }}
            pressStyle={{ backgroundColor: '$backgroundTertiary' }}
            borderRadius="$full"
            testID={ELEMENT.conversationList.newConversation}
            onPress={() => nav.push(routes.newConversation())}
          >
            <Icon name="plus" size="lg" color="$textSecondary" />
          </XStack>

          {/* Settings had a route and no way to reach it, which made the account ID - the one
              thing someone else needs in order to write to this device - unreachable too.

              The hit area is the stack rather than the glyph: a 24pt icon is well under the
              44pt minimum a finger needs, and a target that small is one people miss rather
              than one they cannot see. */}
          <XStack
            width={44}
            height={44}
            alignItems="center"
            justifyContent="center"
            $platform-web={{ cursor: 'pointer' }}
            hoverStyle={{ backgroundColor: '$backgroundSecondary' }}
            pressStyle={{ backgroundColor: '$backgroundTertiary' }}
            borderRadius="$full"
            testID={ELEMENT.conversationList.settings}
            // A modal, so closing it returns to the list.
            onPress={openSettings}
          >
            <Icon name="settings" size="lg" color="$textSecondary" />
          </XStack>
        </XStack>
      </XStack>

      <Separator borderColor="$bordersColor" />

      <List
        data={conversations}
        itemHeight={ROW_HEIGHT_PX}
        keyExtractor={(conversation) => conversation.id}
        renderItem={(conversation, index) => (
          <ConversationRow
            conversation={conversation}
            index={index}
            timeLocale={timeLocale}
            open={conversation.id === openConversationId}
            onPress={() => {
              // Beside the list, a conversation replaces the one already open rather than
              // stacking on it, and the open one again changes nothing. Pushed every time, the
              // history fills with every conversation looked at, and Android's back walks through
              // all of them before it leaves.
              if (conversation.id === openConversationId) return
              const path = routes.conversation(conversation.id)
              if (openConversationId === undefined) nav.push(path)
              else nav.replace(path)
            }}
          />
        )}
        empty={
          <YStack flex={1} alignItems="center" justifyContent="center" padding="$xl">
            <Text tone="secondary" testID={ELEMENT.conversationList.empty}>
              {tr('onboardingHitThePlusButton')}
            </Text>
          </YStack>
        }
      />
    </Screen>
  )
}

const STRIP_COLOR: Record<UnreadTone, '$primaryColor' | '$textDisabled'> = {
  notify: '$primaryColor',
  // Grey, because the conversation is not going to alert: unread, but held quiet by a mute.
  quiet: '$textDisabled',
}

const PILL_COLORS: Record<
  UnreadTone,
  { ground: '$primaryColor' | '$backgroundNested'; text: '$onAccent' | '$textPrimary' }
> = {
  notify: { ground: '$primaryColor', text: '$onAccent' },
  quiet: { ground: '$backgroundNested', text: '$textPrimary' },
}

// TODO: pass the reader's own clock and date layout once the appearance settings exist to choose
// them; until then every row takes the system's.
const TIME_FORMATS: ConversationTimeOptions = { timeFormat: 'system', dateFormat: 'system' }

function UnreadBadgeView({ badge }: { badge: UnreadBadge }) {
  if (badge.kind === 'markedUnread')
    return (
      // The envelope is the height of the count it replaces, so the line does not move.
      <XStack
        width={LINE_HEIGHT}
        height={LINE_HEIGHT}
        position="relative"
        testID={ELEMENT.conversationList.rowMarkedUnread}
      >
        <Icon name="mail" size="md" color="$textPrimary" />
        <XStack
          position="absolute"
          top={0}
          width={MARKED_DOT}
          height={MARKED_DOT}
          borderRadius="$full"
          backgroundColor="$primaryColor"
          {...logical({ insetEnd: 0 })}
        />
      </XStack>
    )

  const colors = PILL_COLORS[badge.tone]
  return (
    <XStack
      backgroundColor={colors.ground}
      borderRadius="$full"
      paddingHorizontal="$xs"
      minWidth={LINE_HEIGHT}
      height={LINE_HEIGHT}
      alignItems="center"
      justifyContent="center"
      testID={ELEMENT.conversationList.rowUnreadBadge}
    >
      <Text size="$caption" weight="bold" color={colors.text}>
        {badge.label}
      </Text>
    </XStack>
  )
}

function ConversationRow({
  conversation,
  index,
  timeLocale,
  open,
  onPress,
}: {
  conversation: Conversation
  index: number
  timeLocale: string | undefined
  open: boolean
  onPress: () => void
}) {
  const title = conversationTitle(conversation)
  const nowMs = Date.now()
  const row = conversationRowState(conversation, nowMs)
  const time =
    conversation.lastActivity > 0
      ? formatConversationTime(conversation.lastActivity, nowMs, {
          ...TIME_FORMATS,
          locale: timeLocale,
        })
      : null

  return (
    <XStack
      height={ROW_HEIGHT_PX}
      paddingHorizontal="$md"
      gap="$sm"
      alignItems="center"
      position="relative"
      {...(open ? { backgroundColor: '$backgroundTertiary' } : {})}
      hoverStyle={{ backgroundColor: open ? '$backgroundTertiary' : '$backgroundSecondary' }}
      pressStyle={{ backgroundColor: '$backgroundTertiary' }}
      $platform-web={{ cursor: 'pointer' }}
      onPress={onPress}
      aria-selected={open}
      testID={ELEMENT.conversationList.row(index)}
    >
      {row.strip === null ? null : (
        <XStack
          position="absolute"
          top={0}
          bottom={0}
          width={STRIP_WIDTH_PX}
          backgroundColor={STRIP_COLOR[row.strip]}
          testID={ELEMENT.conversationList.rowUnreadStrip}
          {...logical({ insetStart: 0 })}
        />
      )}

      {/* TODO: draw a group as its first two members stacked, with Avatar's `members`, once the
          bridge carries a group's member list. */}
      <Avatar id={conversation.id} name={title} size={AVATAR_SIZE} />

      <YStack flex={1} gap="$2xs">
        <XStack height={LINE_HEIGHT} alignItems="center" gap="$2xs">
          {row.kindGlyph === null ? null : (
            <XStack
              width={LINE_HEIGHT}
              height={LINE_HEIGHT}
              flexShrink={0}
              borderRadius="$full"
              backgroundColor="$textPrimary"
              alignItems="center"
              justifyContent="center"
            >
              <Icon name={row.kindGlyph} size="xs" color="$backgroundPrimary" />
            </XStack>
          )}
          {/* The name is the only thing on the line that gives way: the time matters most, then the
              icons, so both are held at their size and the name truncates first. Every item says
              so explicitly, because the web's flexbox shrinks items by default where native does
              not. `minWidth={0}` is what lets the name shrink below its text at all. */}
          <Text
            size="$bodyLarge"
            weight={row.emphasised ? 'bold' : 'semibold'}
            numberOfLines={1}
            flexShrink={1}
            minWidth={0}
            testID={ELEMENT.conversationList.rowName}
          >
            {title}
          </Text>
          {/* TODO: show the Pro badge after the name once the bridge carries a contact's Pro
              status. */}
          {row.pinned || row.muted ? (
            <XStack flexShrink={0} alignItems="center" gap="$2xs">
              {row.pinned ? (
                <Icon
                  name="pin"
                  size="sm"
                  color="$textSecondary"
                  testID={ELEMENT.conversationList.rowPinned}
                />
              ) : null}
              {row.muted ? (
                <Icon
                  name="volumeX"
                  size="sm"
                  color="$textSecondary"
                  testID={ELEMENT.conversationList.rowMuted}
                />
              ) : null}
            </XStack>
          ) : null}
          <XStack flexGrow={1} flexShrink={0} minWidth={TIME_GAP_MIN} />
          {time === null ? null : (
            <Text
              size="$label"
              tone={row.emphasised ? 'primary' : 'secondary'}
              numberOfLines={1}
              flexShrink={0}
              testID={ELEMENT.conversationList.rowTime}
            >
              {time}
            </Text>
          )}
        </XStack>

        <XStack height={LINE_HEIGHT} alignItems="center" gap="$2xs">
          {/* TODO: prefix the snippet with "You:" or the sender, and word an attachment-only
              message, once the bridge carries the snippet's author and attachment fields. */}
          {conversation.snippet === undefined ? (
            <XStack flex={1} />
          ) : (
            <Text
              size="$body"
              tone={row.emphasised ? 'primary' : 'secondary'}
              numberOfLines={1}
              flex={1}
              minWidth={0}
              testID={ELEMENT.conversationList.rowSnippet}
            >
              {conversation.snippet}
            </Text>
          )}
          {/* TODO: show the last message's sent, sending, read or failed icon here on a read row
              once the conversation data carries that message's send and sync state. */}
          {row.badge === null ? null : (
            <XStack flexShrink={0}>
              <UnreadBadgeView badge={row.badge} />
            </XStack>
          )}
        </XStack>
      </YStack>
    </XStack>
  )
}
