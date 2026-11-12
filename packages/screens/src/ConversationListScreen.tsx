import { requirePorts, routes, useNav } from '@session/app'
import type { Conversation } from '@session/client'
import {
  useAccount,
  useConversations,
  useNetworkStatus,
  useUnreadRequestCount,
} from '@session/state'
import { formatConversationTime, tr, type ConversationTimeOptions } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import {
  Avatar,
  FitText,
  GLYPH_MAX_SCALE,
  Icon,
  LABEL_MAX_SCALE,
  List,
  logical,
  Screen,
  SIZE_SCALE,
  SPACE_SCALE,
  StatusDot,
  Text,
  textHeight,
  useFontScale,
  XStack,
  YStack,
} from '@session/ui'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import { NetworkOverlay } from './NetworkOverlay'
import { conversationRowState, type UnreadBadge, type UnreadTone } from './conversationRowState'
import { conversationTitle } from './conversationTitle'
import { useOpenSettings } from './settings/SettingsRootPage'
import { pathStatusTone } from './pathStatus'
import { useBesideRail } from './shell/pane'
import { BAR_CONTROL_SIZE_PX, PaneTitle, PaneTopBar } from './shell/PaneTopBar'
import { useTimeFormats } from './timeFormats'
import { useToday } from './today'
import { useHeldSelection } from './useHeldSelection'

const AVATAR_SIZE_PX = SIZE_SCALE['3xl']
/**
 * Each line is at least this tall whatever it holds, so a row with a pill lines up with one
 * without. The kind glyph's disc and the pill a count sits in are the same height, so neither moves
 * the line. Text set larger than the default outgrows it, and the line grows with the text.
 */
const LINE_HEIGHT = '$md'
const LINE_HEIGHT_PX = SIZE_SCALE.md
/**
 * Takes no width, so a row's contents sit in the same place unread or not. A number because the
 * size ladder stops at 8: a `$2xs` width would resolve against it and draw nothing.
 */
const STRIP_WIDTH_PX = 4
/** The accent dot on the marked-unread envelope. */
const MARKED_DOT = '$xxs'
/** The least room between the end of the name's icons and the time. */
const TIME_GAP_MIN = '$xxs'

const HEADER_AVATAR_PX = SIZE_SCALE.xl
/**
 * The path's status on its corner: the least size its glyph reads at, cut out of the avatar by a
 * ring of the surface rather than lit by a glow.
 */
const HEADER_DOT_PX = SIZE_SCALE.xs
const HEADER_DOT_RING_PX = 2
/**
 * How far the dot's box hangs past the avatar's bottom and end edges: far enough that its centre is
 * 2 px outside the avatar's circle, on the diagonal through the corner. A picture is cropped to the
 * circle, so one with a badge drawn into it shows most of that badge cut off, where the app's own
 * sits whole.
 */
const HEADER_DOT_HANG_PX =
  (HEADER_AVATAR_PX / 2 + 2) / Math.SQRT2 +
  HEADER_DOT_PX / 2 +
  HEADER_DOT_RING_PX -
  HEADER_AVATAR_PX / 2

/**
 * The account's avatar, which opens settings, with the onion path's dot on its bottom-end corner.
 *
 * Only on one pane: beside the rail, the rail has the avatar. The button is named for what it
 * does; the path's state in words is on the Settings row it leads to.
 */
function SettingsAvatarButton({ onPress }: { onPress: () => void }) {
  const account = useAccount()
  const status = useNetworkStatus()
  return (
    // The hit area is the stack rather than the avatar: 32pt is under the 44pt a finger
    // needs, and a target that small is one people miss rather than one they cannot see.
    <XStack
      width={BAR_CONTROL_SIZE_PX}
      height={BAR_CONTROL_SIZE_PX}
      alignItems="center"
      justifyContent="center"
      $platform-web={{ cursor: 'pointer' }}
      hoverStyle={{ backgroundColor: '$hoverOverlay' }}
      pressStyle={{ backgroundColor: '$pressedOverlay' }}
      borderRadius="$full"
      role="button"
      aria-label={tr('sessionSettings')}
      testID={ELEMENT.conversationList.settings}
      // A modal, so closing it returns to the list.
      onPress={onPress}
    >
      <YStack width={HEADER_AVATAR_PX} height={HEADER_AVATAR_PX} position="relative">
        <Avatar
          id={account?.sessionId ?? ''}
          name={account?.displayName ?? ''}
          size={HEADER_AVATAR_PX}
        />
        <YStack
          position="absolute"
          bottom={-HEADER_DOT_HANG_PX}
          {...logical({ insetEnd: -HEADER_DOT_HANG_PX })}
        >
          <StatusDot
            tone={pathStatusTone(status)}
            sidePx={HEADER_DOT_PX}
            glowPx={0}
            ringPx={HEADER_DOT_RING_PX}
            testID={ELEMENT.conversationList.settingsPathStatus}
          />
        </YStack>
      </YStack>
    </XStack>
  )
}

/**
 * One row's size at a text size, which the list needs in order to place a scrollbar without
 * measuring.
 *
 * Counted rather than measured, because the list places rows before any are laid out. Both lines
 * are `numberOfLines={1}`, so the only thing that changes a row's height is the text size: each
 * line is its tallest text at that size or `LINE_HEIGHT`, whichever is more, and the row is the
 * taller of the two lines and the avatar, with the `sm` gap above and below. At the default size
 * that is the design's 72, set by the avatar. The row is drawn at exactly this height so the
 * list's arithmetic and the layout cannot disagree; rounding up leaves under a point to spare.
 */
function rowLayout(fontScale: number): { heightPx: number; avatarPx: number } {
  const avatarPx = Math.round(AVATAR_SIZE_PX * Math.min(Math.max(fontScale, 1), GLYPH_MAX_SCALE))
  const line = (tallest: number): number => Math.max(LINE_HEIGHT_PX, tallest * fontScale)
  // The name sets the first line and the snippet the second; the time and the pill are smaller.
  const textPx = line(textHeight('bodyLarge', 1)) + SPACE_SCALE['2xs'] + line(textHeight('body', 1))
  return {
    heightPx: Math.ceil(Math.max(textPx, avatarPx) + SPACE_SCALE.sm * 2),
    avatarPx,
  }
}

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
  const conversations = useConversations()
  const unreadRequests = useUnreadRequestCount()
  const nav = useNav()
  const openSettings = useOpenSettings()
  const timeFormats = useTimeFormats()
  const besideRail = useBesideRail()
  const fontScale = useFontScale()
  const layout = useMemo(() => rowLayout(fontScale), [fontScale])

  const openConversation = useCallback(
    (id: string) => {
      // Beside the list, a conversation replaces the one already open rather than stacking on
      // it, and the open one again changes nothing. Pushed every time, the history fills with
      // every conversation looked at, and Android's back walks through all of them before it
      // leaves.
      if (id === openConversationId) return
      const path = routes.conversation(id)
      if (openConversationId === undefined) nav.push(path)
      else nav.replace(path)
    },
    [nav, openConversationId],
  )

  // Every prop keeps its identity across a list change, so only the rows that changed, or
  // changed index, are drawn again.
  const renderRow = useCallback(
    (conversation: Conversation, index: number) => (
      <ConversationRow
        conversation={conversation}
        index={index}
        layout={layout}
        timeFormats={timeFormats}
        open={conversation.id === openConversationId}
        onOpen={openConversation}
      />
    ),
    [layout, timeFormats, openConversationId, openConversation],
  )

  return (
    <Screen testID={ELEMENT.conversationList.screen}>
      <PaneTopBar
        leading={
          // Settings had a route and no way to reach it, which made the account ID - the one thing
          // someone else needs in order to write to this device - unreachable too. On the leading
          // side, before the title.
          besideRail ? null : <SettingsAvatarButton onPress={openSettings} />
        }
        title={
          <NetworkOverlay>
            <PaneTitle>{tr('messages')}</PaneTitle>
          </NetworkOverlay>
        }
        trailing={
          <>
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
              width={BAR_CONTROL_SIZE_PX}
              height={BAR_CONTROL_SIZE_PX}
              alignItems="center"
              justifyContent="center"
              $platform-web={{ cursor: 'pointer' }}
              hoverStyle={{ backgroundColor: '$hoverOverlay' }}
              pressStyle={{ backgroundColor: '$pressedOverlay' }}
              borderRadius="$full"
              testID={ELEMENT.conversationList.newConversation}
              onPress={() => nav.push(routes.newConversation())}
            >
              <Icon name="plus" size="lg" color="$textSecondary" />
            </XStack>
          </>
        }
      />

      <List
        data={conversations}
        itemHeight={layout.heightPx}
        keyExtractor={conversationKey}
        renderItem={renderRow}
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

/**
 * A muted conversation's unread marks are the same shapes as a loud one's in the secondary text
 * colour: quieter, not different. That colour is held to text contrast against the page, so the
 * strip and pill clear the 3:1 an indicator needs in every theme, the selected row's ground
 * included.
 */
const STRIP_COLOR: Record<UnreadTone, '$primaryColor' | '$textSecondary'> = {
  notify: '$primaryColor',
  quiet: '$textSecondary',
}

const PILL_COLORS: Record<
  UnreadTone,
  { ground: '$primaryColor' | '$textSecondary'; text: '$onAccent' | '$backgroundPrimary' }
> = {
  notify: { ground: '$primaryColor', text: '$onAccent' },
  quiet: { ground: '$textSecondary', text: '$backgroundPrimary' },
}

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
      minHeight={LINE_HEIGHT}
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

function conversationKey(conversation: Conversation): string {
  return conversation.id
}

/** setTimeout's longest delay; a longer one fires at once. */
const LONGEST_TIMER_MS = 2 ** 31 - 1

/**
 * Draws the component again once the clock reaches `atMs`, which changes no prop of a row.
 *
 * Aimed again each time rather than trusted once: a timer can fire a little early, cannot wait
 * longer than `LONGEST_TIMER_MS`, and does not run while the app is suspended, which coming back
 * to the front makes up for.
 */
function useRedrawAt(atMs: number | undefined): void {
  const [, redraw] = useState(0)
  useEffect(() => {
    if (atMs === undefined || atMs <= Date.now()) return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let reached = false
    const aim = (): void => {
      if (reached) return
      clearTimeout(timer)
      const waitMs = atMs - Date.now()
      if (waitMs > 0) {
        timer = setTimeout(aim, Math.min(waitMs, LONGEST_TIMER_MS))
        return
      }
      reached = true
      redraw((n) => n + 1)
    }
    aim()
    const stopFocus = requirePorts().window.onFocusChange((focused) => {
      if (focused) aim()
    })
    return () => {
      clearTimeout(timer)
      stopFocus()
    }
  }, [atMs])
}

const ConversationRow = memo(function ConversationRow({
  conversation,
  index,
  layout,
  timeFormats,
  open,
  onOpen,
}: {
  conversation: Conversation
  index: number
  layout: { heightPx: number; avatarPx: number }
  timeFormats: ConversationTimeOptions
  open: boolean
  onOpen: (id: string) => void
}) {
  const title = conversationTitle(conversation)
  const selected = useHeldSelection(open)
  // Read for its change: a row that says a weekday or the time alone is redrawn when the day turns.
  useToday()
  useRedrawAt(conversation.muteUntil)
  const nowMs = Date.now()
  const row = conversationRowState(conversation, nowMs)
  const time =
    conversation.lastActivity > 0
      ? formatConversationTime(conversation.lastActivity, nowMs, timeFormats)
      : null

  return (
    <XStack
      height={layout.heightPx}
      paddingHorizontal="$md"
      gap="$sm"
      alignItems="center"
      position="relative"
      // Overlays, so each state is a step from whatever the list is drawn on. The open row holds
      // the pressed step, which hovering it does not lighten.
      {...(selected.held ? { backgroundColor: '$pressedOverlay' } : {})}
      hoverStyle={{ backgroundColor: selected.held ? '$pressedOverlay' : '$hoverOverlay' }}
      pressStyle={{ backgroundColor: '$pressedOverlay' }}
      $platform-web={{ cursor: 'pointer' }}
      onPress={() => {
        selected.hold()
        onOpen(conversation.id)
      }}
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
      <Avatar id={conversation.id} name={title} size={layout.avatarPx} />

      <YStack flex={1} gap="$2xs">
        <XStack minHeight={LINE_HEIGHT} alignItems="center" gap="$2xs">
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
          {/* The name is what gives way: the time matters most, then the icons, so both are held at
              their size and the name truncates first. Every item says so explicitly, because the
              web's flexbox shrinks items by default where native does not. `minWidth={0}` is what
              lets the name shrink below its text at all. The time's own limit is below. */}
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
            // Held to half the line, and shrunk to fit past that rather than truncated: at a large
            // text size or zoom in a narrow list column a full date can be as wide as the whole
            // line, and the name has to keep some of it. A label, so it stops growing where labels
            // do.
            <FitText
              size="$label"
              tone={row.emphasised ? 'primary' : 'secondary'}
              flexShrink={0}
              maxWidth="50%"
              maxFontSizeMultiplier={LABEL_MAX_SCALE}
              testID={ELEMENT.conversationList.rowTime}
            >
              {time}
            </FitText>
          )}
        </XStack>

        <XStack minHeight={LINE_HEIGHT} alignItems="center" gap="$2xs">
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
})
