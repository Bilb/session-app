import { requirePorts } from '@session/app'
import { formatBytes, MAX_ATTACHMENTS_PER_MESSAGE } from '@session/basic-types'
import type { ConversationId } from '@session/client'
import {
  useAttachmentUploadLimit,
  useConversation,
  useMessages,
  useSessionActions,
} from '@session/state'
import { PENDING_COPY, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { DropOverlay, DropZone, List, Screen, Separator, Text, XStack, YStack } from '@session/ui'
import { useMemo, useState } from 'react'

import { AttachmentSheet } from './AttachmentSheet'
import { Composer } from './Composer'
import { outgoingAttachment } from './staging'
import { useStaging } from './useStaging'
import { ConversationUiContext, type ConversationUi } from './conversationUi'
import { MessageMediaViewer, type ViewerTarget } from './MessageMediaViewer'
import { MessageRow } from './MessageRow'
import { AutoDownloadPrompt } from './AutoDownloadPrompt'
import { BackButton } from './BackButton'
import { conversationTitle } from './conversationTitle'
import { DateHeaderRow } from './DateHeaderRow'
import { showsDateHeader } from './dateHeaders'
import { useTopBarInsets } from './shell/pane'

function Conversation({ conversationId }: { conversationId: ConversationId }) {
  const topBarInsets = useTopBarInsets()
  const conversation = useConversation(conversationId)
  const { messages, ready } = useMessages(conversationId)
  const actions = useSessionActions()
  const staging = useStaging((file) => actions.attachmentSendPlan(file.path, file.contentType))
  const [dropping, setDropping] = useState(false)
  const uploadLimitBytes = useAttachmentUploadLimit()
  // Unset means nobody has been asked what this conversation should fetch unprompted, which is
  // not the same as having been asked and said no. Asked once, on the first attachment fetched.
  // A request made while the conversation is still loading is held, and asked once it is known
  // to be unset.
  const [prompting, setPrompting] = useState(false)
  const autoDownload = conversation?.autoDownload
  const asking = prompting && conversation !== undefined && autoDownload === undefined
  // One viewer and one sheet for the whole transcript, so two can never be open at once.
  const [viewer, setViewer] = useState<ViewerTarget | null>(null)
  const [sheet, setSheet] = useState<number | null>(null)

  // Memoised so typing in the composer does not re-render every message through the context.
  const ui = useMemo(
    (): ConversationUi => ({
      conversationId,
      requestAutoDownloadPrompt: () => {
        if (autoDownload === undefined) setPrompting(true)
      },
      openViewer: (messageId, index) => {
        setViewer({ messageId, index })
      },
      openSheet: setSheet,
    }),
    [conversationId, autoDownload],
  )

  // The id stands in for the conversation as well as for the name: opening one from a route
  // beats the store hydrating it, and a header that says nothing for a moment is a header
  // that flickers.
  const title = conversationTitle(conversation ?? { id: conversationId })

  return (
    <ConversationUiContext.Provider value={ui}>
      <Screen testID={ELEMENT.conversation.screen}>
        <XStack
          paddingHorizontal="$md"
          paddingVertical="$sm"
          gap="$sm"
          alignItems="center"
          testID={ELEMENT.conversation.header}
          {...topBarInsets}
        >
          <BackButton testID={ELEMENT.conversation.back} />
          <Text
            size="$bodyLarge"
            weight="semibold"
            numberOfLines={1}
            testID={ELEMENT.conversation.headerName}
          >
            {title}
          </Text>
        </XStack>

        <Separator borderColor="$bordersColor" />

        <DropZone
          // Refused while a send is out, as the tray's + is: the tray is the message's until then.
          accepting={!staging.sending}
          onActive={setDropping}
          onDrop={(items, skipped) => {
            void staging.take(requirePorts().files.droppedFiles(items), skipped + items.length)
          }}
          overlay={
            // A conversation is reached only after the start that reads the limit.
            dropping && uploadLimitBytes !== null ? (
              <DropOverlay
                title={tr('attachmentsAdd')}
                hint={PENDING_COPY.attachmentsDropHint(
                  MAX_ATTACHMENTS_PER_MESSAGE,
                  formatBytes(uploadLimitBytes),
                )}
                testID={ELEMENT.conversation.dropOverlay}
              />
            ) : undefined
          }
        >
          {ready ? (
            // No itemHeight: a bubble is as tall as its body wraps to, so the list has to measure.
            <List
              data={messages}
              keyExtractor={(message) => String(message.id)}
              renderItem={(message, index) => (
                <YStack paddingHorizontal="$md" paddingBottom="$sm">
                  {showsDateHeader(messages[index - 1], message) ? (
                    <DateHeaderRow timestampMs={message.timestamp} />
                  ) : null}
                  <MessageRow
                    conversationId={conversationId}
                    messageId={message.id}
                    index={index}
                  />
                </YStack>
              )}
            />
          ) : (
            <YStack flex={1} padding="$md">
              <Text tone="secondary">{tr('loading')}</Text>
            </YStack>
          )}

          <Composer
            staging={staging}
            onSend={(body, files) => {
              const { picksAreCopies } = requirePorts().files
              return actions.send(conversationId, {
                body,
                attachments: files.map((file) => outgoingAttachment(file, { picksAreCopies })),
              })
            }}
          />
        </DropZone>

        <AttachmentSheet
          conversationId={conversationId}
          messageId={sheet}
          onClose={() => {
            setSheet(null)
          }}
          overlay={
            <>
              <MessageMediaViewer
                conversationId={conversationId}
                // Held back while the prompt is up: iOS presents one modal per parent at a time.
                target={asking ? null : viewer}
                onIndex={(index) => {
                  setViewer((open) => (open === null ? null : { ...open, index }))
                }}
                onClose={() => {
                  setViewer(null)
                }}
              />
              {conversation === undefined ? null : (
                <AutoDownloadPrompt
                  open={asking}
                  conversationId={conversationId}
                  conversationName={title}
                  onAnswered={() => {
                    setPrompting(false)
                  }}
                />
              )}
            </>
          }
        />
      </Screen>
    </ConversationUiContext.Provider>
  )
}

/**
 * One conversation: its transcript and a composer.
 *
 * The id arrives as a prop rather than being read off a route. Which router put it there is
 * the app's business, and reading it here would be the one import that pins this screen to
 * a platform again.
 */
export function ConversationScreen({ conversationId }: { conversationId: string }) {
  // A wide layout keeps this mounted and changes only the id; the key gives each conversation
  // its own draft and open overlays.
  return <Conversation key={conversationId} conversationId={conversationId} />
}
