import { requirePorts } from '@session/app'
import { isDisplayableImage } from '@session/basic-types'
import type { ConversationId, Message } from '@session/client'
import { transferKey, type SessionStore } from '@session/state'

/** A running download, as each of a message's files reports it, in encrypted bytes. */
interface Running {
  doneBytes: number
  totalBytes: number
}

/**
 * What a few rows' messages are put through before any page draws, by body. Each is its own
 * message, never one another page draws at rest: the store is shared by every page.
 */
const PREPARE: Record<string, 'downloaded' | 'downloadFailed' | Running> = {
  'Two, one above the other': 'downloaded',
  'Four in two rows': { doneBytes: 50, totalBytes: 100 },
  'Five: two above three': 'downloadFailed',
  // The first report of every transfer, before a byte is here.
  'A pair for the ring at 0 of 0': { doneBytes: 0, totalBytes: 0 },
  'A pair for the ring at 40%': { doneBytes: 40, totalBytes: 100 },
  'A pair for the ring at 95%': { doneBytes: 95, totalBytes: 100 },
  'Ours from another device, for the ring at 0 of 0': { doneBytes: 0, totalBytes: 0 },
  'Ours from another device, for the ring at 40%': { doneBytes: 40, totalBytes: 100 },
  'Ours from another device, for the ring at 95%': { doneBytes: 95, totalBytes: 100 },
  'One file, caught downloading': { doneBytes: 40, totalBytes: 100 },
  'One picture as a list, caught downloading': { doneBytes: 40, totalBytes: 100 },
}

/**
 * Ours, so its uploaded pictures are cached and thumbnailed, as a staged file's picture is. Its
 * thirty uploaded pictures take the fake's photo counter thirty times running, so they are every
 * dev photograph once, whatever the showcase draws before it.
 */
const PICTURES_FROM = 'File 31 of 32 failed'

const POLL_MS = 50

async function until(ready: () => boolean): Promise<void> {
  while (!ready()) await new Promise((resolve) => setTimeout(resolve, POLL_MS))
}

/** The showcase's conversation, and its messages' ids by body. */
export interface Scenario {
  conversationId: ConversationId
  messageIds: Map<string, number>
  /** Thumbnails of dev photographs that draw without a download, for files the catalog stages. */
  pictures: string[]
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
            preparation === 'downloadFailed'
              ? { state: 'failed' as const, doneBytes: 0, totalBytes: 100 }
              : { state: 'running' as const, ...preparation },
          ]),
        ),
      },
    }))
  }

  const { media } = requirePorts()
  const source = byBody(PICTURES_FROM)
  // In filename order rather than the message's: the fake names a picture for its photograph, and
  // the counter's starting photo moves whenever the showcase gains a picture above this message.
  const pictures = source.attachments
    .filter(({ uploaded, contentType }) => uploaded && isDisplayableImage(contentType))
    .sort((a, b) => (a.filename ?? '').localeCompare(b.filename ?? ''))
    .map(({ index }) => media.thumbnailUrlFor({ messageId: source.id, index }))
    .filter((url): url is string => url !== null)

  return {
    conversationId,
    messageIds: new Map(messages.map((message) => [message.body, message.id])),
    pictures,
  }
}
