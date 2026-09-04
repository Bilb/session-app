import { useNav } from '@session/app'
import type { Message } from '@session/client'
import { useConversation, useMessages, useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { Button, Input, Screen, ScrollView, Separator, Text, XStack, YStack } from '@session/ui'
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
          grow
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

/**
 * Which states are worth offering a retry for.
 *
 * `failed` and `interrupted` are worth another attempt — something was unreachable. `unsendable`
 * is not: libsession keeps it apart precisely so a client knows which failures to offer a retry
 * for, and it means something the message needs is gone rather than merely unreachable, so
 * retrying re-reads the same missing file and fails identically every time.
 */
const RETRYABLE: readonly Message['sendState'][] = ['failed', 'interrupted']

function MessageRow({ message, index }: { message: Message; index: number }) {
  const actions = useSessionActions()
  const label = message.outgoing ? STATE_LABEL[message.sendState] : undefined
  const retryable = message.outgoing && RETRYABLE.includes(message.sendState)

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
        <XStack alignItems="center" gap="$1">
          <Text size="$2" tone="secondary" testID={ELEMENT.conversation.messageState}>
            {label}
          </Text>
          {retryable ? (
            <Text
              size="$2"
              tone="accent"
              testID={ELEMENT.conversation.messageRetry}
              onPress={() => {
                // Resumes rather than restarts, so an attachment that already uploaded is not
                // sent twice. The state comes back as an update; nothing to do here.
                void actions.retry(message.id)
              }}
            >
              Retry
            </Text>
          ) : null}
        </XStack>
      )}
    </YStack>
  )
}
