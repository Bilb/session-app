import { routes, useNav } from '@s2/app'
import type { Conversation } from '@s2/client'
import { useConversations, useUnreadRequestCount } from '@s2/state'
import { ELEMENT } from '@s2/test-ids'
import { Avatar, Screen, ScrollView, Separator, Text, XStack, YStack } from '@s2/ui'

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

  return (
    <Screen testID={ELEMENT.conversationList.screen}>
      <XStack
        paddingHorizontal="$2"
        paddingVertical="$1.5"
        alignItems="center"
        justifyContent="space-between"
      >
        <Text size="$6" weight="bold">
          Messages
        </Text>
        {unreadRequests > 0 ? (
          <XStack
            backgroundColor="$primaryColor"
            borderRadius="$full"
            paddingHorizontal="$1"
            minWidth={20}
            height={20}
            alignItems="center"
            justifyContent="center"
            testID={ELEMENT.requests.badge}
            onPress={() => nav.push(routes.requests())}
          >
            <Text size="$2" weight="bold" color="$backgroundPrimary">
              {unreadRequests}
            </Text>
          </XStack>
        ) : null}
      </XStack>

      <Separator borderColor="$bordersColor" />

      {conversations.length === 0 ? (
        <YStack flex={1} alignItems="center" justifyContent="center" padding="$3">
          <Text tone="secondary" testID={ELEMENT.conversationList.empty}>
            No conversations yet
          </Text>
        </YStack>
      ) : (
        <ScrollView flex={1}>
          {conversations.map((conversation, index) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              index={index}
              onPress={() => nav.push(routes.conversation(conversation.id))}
            />
          ))}
        </ScrollView>
      )}
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
  const name = conversation.nickname ?? conversation.displayName

  return (
    <XStack
      paddingHorizontal="$2"
      paddingVertical="$1.5"
      gap="$2"
      alignItems="center"
      hoverStyle={{ backgroundColor: '$backgroundSecondary' }}
      pressStyle={{ backgroundColor: '$backgroundTertiary' }}
      cursor="pointer"
      onPress={onPress}
      testID={ELEMENT.conversationList.row(index)}
    >
      <Avatar id={conversation.id} name={name} />

      <YStack flex={1} gap="$0.5">
        <Text
          size="$4"
          weight={conversation.unreadCount > 0 ? 'bold' : 'regular'}
          numberOfLines={1}
          testID={ELEMENT.conversationList.rowName}
        >
          {name}
        </Text>
        {conversation.snippet === undefined ? null : (
          <Text
            size="$3"
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
          paddingHorizontal="$1"
          minWidth={20}
          height={20}
          alignItems="center"
          justifyContent="center"
          testID={ELEMENT.conversationList.rowUnreadBadge}
        >
          <Text size="$2" weight="bold" color="$backgroundPrimary">
            {conversation.unreadCount}
          </Text>
        </XStack>
      ) : null}
    </XStack>
  )
}
