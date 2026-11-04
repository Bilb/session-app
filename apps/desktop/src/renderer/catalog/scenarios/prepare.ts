import type { ConversationId, Message } from '@session/client'
import { transferKey, type SessionStore } from '@session/state'

/**
 * What a few rows' messages are put through before any page draws, by body. Each is its own
 * message, never one another page draws at rest: the store is shared by every page.
 */
const PREPARE: Record<string, 'downloaded' | 'downloading' | 'downloadFailed'> = {
  'Two, one above the other': 'downloaded',
  'Four in two rows': 'downloading',
  'Five: two above three': 'downloadFailed',
}

const POLL_MS = 50

async function until(ready: () => boolean): Promise<void> {
  while (!ready()) await new Promise((resolve) => setTimeout(resolve, POLL_MS))
}

/** The showcase's conversation, and its messages' ids by body. */
export interface Scenario {
  conversationId: ConversationId
  messageIds: Map<string, number>
}

export async function prepare(session: SessionStore): Promise<Scenario> {
  void session.actions.start()
  await until(() => session.getState().conversations.length > 0)
  const conversation = session.getState().conversations[0]
  if (conversation === undefined) throw new Error('the showcase has no conversation')
  const conversationId = conversation.id
  await session.actions.loadHistory(conversationId)
  while (session.getState().histories[conversationId]?.exhausted !== true)
    await session.actions.loadOlder(conversationId)

  const messages = session.getState().histories[conversationId]?.messages ?? []
  const byBody = (body: string): Message => {
    const found = messages.find((message) => message.body === body)
    if (found === undefined) throw new Error(`the showcase has no message "${body}"`)
    return found
  }

  for (const [body, preparation] of Object.entries(PREPARE)) {
    const message = byBody(body)
    if (preparation === 'downloaded') {
      for (const { index } of message.attachments)
        await session.actions.downloadAttachment({ messageId: message.id, index })
      await until(
        () =>
          (session.getState().histories[conversationId]?.messages ?? [])
            .find((candidate) => candidate.id === message.id)
            ?.attachments.every((attachment) => attachment.availability === 'cached') === true,
      )
      continue
    }
    session.setState((state) => ({
      transfers: {
        ...state.transfers,
        [message.id]: Object.fromEntries(
          message.attachments.map(({ index }) => [
            transferKey('download', index),
            preparation === 'downloading'
              ? { state: 'running' as const, doneBytes: 50, totalBytes: 100 }
              : { state: 'failed' as const, doneBytes: 0, totalBytes: 100 },
          ]),
        ),
      },
    }))
  }

  return {
    conversationId,
    messageIds: new Map(messages.map((message) => [message.body, message.id])),
  }
}
