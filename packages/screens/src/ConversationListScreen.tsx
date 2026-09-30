import { routes, useNav } from '@session/app'
import type { Conversation } from '@session/client'
import { useConversations, useUnreadRequestCount } from '@session/state'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Avatar, Icon, List, Screen, Separator, Text, XStack, YStack } from '@session/ui'

import { NetworkOverlay } from './NetworkOverlay'
import { conversationTitle } from './conversationTitle'
import { useOpenSettings } from './settings/SettingsRootPage'

/**
 * The height of one row, which the list needs in order to place a scrollbar without measuring.
 *
 * It is `$1.5` of padding top and bottom either side of a 40px avatar - the tallest thing in the
 * row - and both text lines are `numberOfLines={1}`, so nothing here can wrap and change it. A row
 * that grew a second line would need this changed with it; `ConversationRow` is the only place
 * that could, which is why the constant lives beside it.
 */
const ROW_HEIGHT = 60

/**
 * The conversation list.
 *
 * It reads the store and navigates through the port, so it is the same screen on a phone,
 * in a tablet's left pane and in the desktop window. Which of those it is showing in is
 * AdaptiveShell's business, not its own.
 */
export function ConversationListScreen() {
  const conversations = useConversations()
  const unreadRequests = useUnreadRequestCount()
  const nav = useNav()
  const openSettings = useOpenSettings()

  return (
    <Screen testID={ELEMENT.conversationList.screen}>
      <XStack
        paddingHorizontal="$md"
        paddingVertical="$sm"
        alignItems="center"
        justifyContent="space-between"
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
            cursor="pointer"
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
            cursor="pointer"
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
        itemHeight={ROW_HEIGHT}
        keyExtractor={(conversation) => conversation.id}
        renderItem={(conversation, index) => (
          <ConversationRow
            conversation={conversation}
            index={index}
            onPress={() => nav.push(routes.conversation(conversation.id))}
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

function ConversationRow({
  conversation,
  index,
  onPress,
}: {
  conversation: Conversation
  index: number
  onPress: () => void
}) {
  const title = conversationTitle(conversation)

  return (
    <XStack
      height={ROW_HEIGHT}
      paddingHorizontal="$md"
      gap="$md"
      alignItems="center"
      hoverStyle={{ backgroundColor: '$backgroundSecondary' }}
      pressStyle={{ backgroundColor: '$backgroundTertiary' }}
      cursor="pointer"
      onPress={onPress}
      testID={ELEMENT.conversationList.row(index)}
    >
      <Avatar id={conversation.id} name={title} />

      <YStack flex={1} gap="$2xs">
        <Text
          size="$body"
          weight={conversation.unreadCount > 0 ? 'bold' : 'regular'}
          numberOfLines={1}
          testID={ELEMENT.conversationList.rowName}
        >
          {title}
        </Text>
        {conversation.snippet === undefined ? null : (
          <Text
            size="$label"
            tone="secondary"
            numberOfLines={1}
            testID={ELEMENT.conversationList.rowSnippet}
          >
            {conversation.snippet}
          </Text>
        )}
      </YStack>

      {conversation.unreadCount > 0 ? (
        <XStack
          backgroundColor="$primaryColor"
          borderRadius="$full"
          paddingHorizontal="$xs"
          minWidth={20}
          height={20}
          alignItems="center"
          justifyContent="center"
          testID={ELEMENT.conversationList.rowUnreadBadge}
        >
          <Text size="$caption" weight="bold" color="$onAccent">
            {conversation.unreadCount}
          </Text>
        </XStack>
      ) : null}
    </XStack>
  )
}
