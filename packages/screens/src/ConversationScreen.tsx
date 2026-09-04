import { useNav } from '@s2/app'
import type { Message } from '@s2/client'
import { useConversation, useMessages, useSessionActions } from '@s2/state'
import { ELEMENT } from '@s2/test-ids'
import { Button, Input, Screen, ScrollView, Separator, Text, XStack, YStack } from '@s2/ui'
import { useState } from 'react'

/**
 * One conversation: its transcript and a composer.
 *
 * The id arrives as a prop rather than being read off a route. Which router put it there is
 * the app's business, and reading it here would be the one import that pins this screen to
 * a platform again.
 */
export function ConversationScreen({ conversationId }: { conversationId: string }) {
  const conversation = useConversation(conversationId)
  const { messages, ready } = useMessages(conversationId)
  const actions = useSessionActions()
  const nav = useNav()
  const [draft, setDraft] = useState('')

  function send(): void {
    const body = draft.trim()
    if (body.length === 0) return
    // Cleared straight away: libsession stores the row before the promise settles, so the
    // message appears on its own and there is nothing to put back if this fails.
    setDraft('')
    void actions.send(conversationId, body)
  }

  const name = conversation?.nickname ?? conversation?.displayName ?? conversationId

  return (
    <Screen testID={ELEMENT.conversation.screen}>
      <XStack
        paddingHorizontal="$2"
        paddingVertical="$1.5"
        gap="$1.5"
        alignItems="center"
        testID={ELEMENT.conversation.header}
      >
        <Button
          variant="ghost"
          size="sm"
          onPress={() => nav.back()}
          testID={ELEMENT.conversation.back}
        >
          Back
        </Button>
        <Text
          size="$5"
          weight="semibold"
          numberOfLines={1}
          testID={ELEMENT.conversation.headerName}
        >
          {name}
        </Text>
      </XStack>

      <Separator borderColor="$bordersColor" />

      <ScrollView flex={1} padding="$2">
        {ready ? (
          <YStack gap="$1.5">
            {messages.map((message, index) => (
              <MessageRow key={message.id} message={message} index={index} />
            ))}
          </YStack>
        ) : (
          <Text tone="secondary">Loading…</Text>
        )}
      </ScrollView>

      <XStack
        padding="$2"
        gap="$1.5"
        alignItems="center"
        borderTopWidth={1}
        borderTopColor="$bordersColor"
      >
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          onSubmit={send}
          testID={ELEMENT.conversation.composerInput}
        />
        <Button
          size="md"
          onPress={send}
          disabled={draft.trim().length === 0}
          testID={ELEMENT.conversation.sendButton}
        >
          Send
        </Button>
      </XStack>
    </Screen>
  )
}

/** What a send state is called on screen. Only the ones worth showing say anything. */
const STATE_LABEL: Partial<Record<Message['sendState'], string>> = {
  pending: 'Sending…',
  sending: 'Sending…',
  uploading: 'Uploading…',
  failed: 'Failed',
  interrupted: 'Interrupted',
  unsendable: 'Cannot send',
}

function MessageRow({ message, index }: { message: Message; index: number }) {
  const label = message.outgoing ? STATE_LABEL[message.sendState] : undefined

  return (
    <YStack
      alignSelf={message.outgoing ? 'flex-end' : 'flex-start'}
      maxWidth="80%"
      backgroundColor={message.outgoing ? '$messageBubbleOutgoingBg' : '$messageBubbleIncomingBg'}
      borderRadius="$3"
      paddingHorizontal="$2"
      paddingVertical="$1.5"
      gap="$0.5"
      testID={ELEMENT.conversation.messageRow(index)}
    >
      <Text
        size="$4"
        color={message.outgoing ? '$messageBubbleOutgoingText' : '$messageBubbleIncomingText'}
        testID={ELEMENT.conversation.messageBody}
      >
        {message.body}
      </Text>
      {label === undefined ? null : (
        <Text size="$2" tone="secondary" testID={ELEMENT.conversation.messageState}>
          {label}
        </Text>
      )}
    </YStack>
  )
}
