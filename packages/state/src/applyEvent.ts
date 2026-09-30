import type {
  AttachmentRef,
  AttachmentTransfer,
  Conversation,
  ConversationId,
  Message,
  SessionEvent,
} from '@session/client'

import type { AttachmentTransferState, MessageWindow, SessionState } from './types'
import { transferKey } from './types'

/**
 * The whole projection, as one pure function.
 *
 * Every event carries complete state, so this only ever replaces - it never merges a delta
 * or goes back to ask for the rest. That is what makes replaying the same event twice
 * harmless, and what lets the store be seeded and then have earlier events land on top of
 * it without contradicting themselves.
 *
 * The objects the bridge hands over are stored as they are: this rebuilds the containers on the
 * path to a change (a map, an id array) and nothing inside them.
 */
export function applyEvent(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'conversation-added':
    case 'conversation-updated':
      return upsertConversation(state, event.conversation)

    case 'conversation-removed':
      return removeConversation(state, event.conversationId)

    case 'conversation-list-replaced':
      return { ...state, conversations: event.conversations }

    case 'request-list-replaced':
      return { ...state, requests: event.conversations }

    case 'messages-added':
    case 'messages-updated':
      // Folded one at a time rather than grouped by conversation first: a batch may span
      // conversations, and applying them in the order given is what makes the result the same
      // as a reload.
      return event.messages.reduce(
        (next, message) => upsertMessage(next, message.conversationId, message),
        state,
      )

    case 'history-replaced': {
      // Only the id comes back, so the window is dropped rather than patched: whatever is
      // left of it is no longer known to be true. The screen refetches.
      const window = state.histories[event.conversationId]
      return {
        ...state,
        histories: {
          ...state.histories,
          [event.conversationId]: {
            ready: false,
            messages: [],
            exhausted: false,
            fetching: false,
          },
        },
        transfers: withoutHistory(state.transfers, window?.messages ?? []),
      }
    }

    case 'attachment-progress':
      return recordTransfer(state, event)

    case 'log':
      return state

    default:
      // A new SessionEvent arm is a compile error here, as it is in the shim and the fake.
      // Still returns state: a bridge newer than the app is survivable.
      event satisfies never
      return state
  }
}

/**
 * Records one report, dropping those for a message no loaded window holds.
 *
 * By message, because a report names no conversation. A report that arrives between a message
 * being announced and it landing in a window is dropped; the bar starts on the next one.
 */
function recordTransfer(
  state: SessionState,
  event: Extract<SessionEvent, { type: 'attachment-progress' }>,
): SessionState {
  if (!isLoaded(state, event.messageId)) return state

  const entry: AttachmentTransferState = {
    // An outcome ends a transfer; `doneBytes === totalBytes` does not, and arrives before it.
    state: event.outcome === undefined ? 'running' : event.outcome.ok ? 'done' : 'failed',
    doneBytes: event.doneBytes,
    totalBytes: event.totalBytes,
    ...(event.outcome?.error === undefined ? {} : { error: event.outcome.error }),
  }

  const transfers = state.transfers[event.messageId]
  const key = transferKey(event.transfer, event.index)
  // A download joined by a second handler reports every step once per handler.
  if (sameTransfer(transfers?.[key], entry)) return state

  return {
    ...state,
    transfers: { ...state.transfers, [event.messageId]: { ...transfers, [key]: entry } },
  }
}

/**
 * Records a command libsession refused before any transfer existed, as a failed one.
 *
 * Such a refusal reaches no event, so without this the only thing that knew was whichever caller
 * held the promise. A report that already said `failed` is left alone: it carries the real figures.
 */
export function recordRefusal(
  state: SessionState,
  transfer: AttachmentTransfer,
  ref: AttachmentRef,
): SessionState {
  if (state.transfers[ref.messageId]?.[transferKey(transfer, ref.index)]?.state === 'failed')
    return state
  return recordTransfer(state, {
    type: 'attachment-progress',
    transfer,
    messageId: ref.messageId,
    index: ref.index,
    doneBytes: 0,
    totalBytes: 0,
    outcome: { ok: false },
  })
}

function sameTransfer(
  stored: AttachmentTransferState | undefined,
  entry: AttachmentTransferState,
): boolean {
  return (
    stored !== undefined &&
    stored.state === entry.state &&
    stored.doneBytes === entry.doneBytes &&
    stored.totalBytes === entry.totalBytes &&
    stored.error === entry.error
  )
}

/** Whether any loaded window holds this message, which is what makes a report worth keeping. */
function isLoaded(state: SessionState, messageId: number): boolean {
  return Object.values(state.histories).some(
    (window) => window.ready && window.messages.some((m) => m.id === messageId),
  )
}

/** The transfers without those of the messages a dropped window held. */
export function withoutHistory(
  transfers: SessionState['transfers'],
  messages: readonly Message[],
): SessionState['transfers'] {
  const dropped = messages.filter((m) => m.id in transfers)
  if (dropped.length === 0) return transfers
  const kept = { ...transfers }
  for (const message of dropped) delete kept[message.id]
  return kept
}

type ListKey = 'conversations' | 'requests'

/**
 * The list without `id`, or the same array when it was not in it.
 *
 * Returning the same one matters: a screen subscribed to the request list would otherwise be
 * handed a new array on every message that arrives in a conversation, and re-render for a change
 * that never touched it.
 */
function without(list: Conversation[], id: ConversationId): Conversation[] {
  return list.some((c) => c.id === id) ? list.filter((c) => c.id !== id) : list
}

/**
 * Approval arrives as an update, not as a removal followed by an addition, so a row that
 * changed side has to be taken out of the list it used to be in. Missing this is what makes
 * a conversation appear in both lists at once.
 */
function upsertConversation(state: SessionState, conversation: Conversation): SessionState {
  const to: ListKey = conversation.request ? 'requests' : 'conversations'
  const from: ListKey = conversation.request ? 'conversations' : 'requests'

  const at = state[to].findIndex((c) => c.id === conversation.id)
  let target: Conversation[]
  if (at === -1) {
    // Appended, because where it belongs is not this file's decision: libsession orders the
    // lists, and the only case that moves a conversation between them - approval - is followed
    // by a replacement carrying the real order, so an appended row is corrected within the same
    // batch rather than left where it was put.
    target = [...state[to], conversation]
  } else {
    target = state[to].slice()
    target[at] = conversation
  }

  return { ...state, [from]: without(state[from], conversation.id), [to]: target }
}

function removeConversation(state: SessionState, id: ConversationId): SessionState {
  const { [id]: history, ...histories } = state.histories

  return {
    ...state,
    conversations: without(state.conversations, id),
    requests: without(state.requests, id),
    histories,
    transfers: withoutHistory(state.transfers, history?.messages ?? []),
  }
}

/**
 * Adds or replaces a message, but only in a window that has already been loaded.
 *
 * Starting a window from a single event would leave a transcript that looks complete and is
 * not; the screen asks for the history it wants and events keep it current from there.
 */
function upsertMessage(
  state: SessionState,
  conversationId: ConversationId,
  message: Message,
): SessionState {
  const window = state.histories[conversationId]
  if (!window?.ready) return state

  const current = window.messages
  const existing = current.findIndex((m) => m.id === message.id)
  let messages: Message[]
  if (existing >= 0) {
    messages = current.slice()
    messages[existing] = message
  } else {
    // On the end, without checking where it belongs. The event reports a message that has just
    // happened, and libsession decides the order a transcript reads in - the shim already turns
    // its newest-first page around. A comparator here would be this package deciding it again.
    messages = [...current, message]
  }

  const updated: MessageWindow = { ...window, messages }
  return {
    ...state,
    histories: { ...state.histories, [conversationId]: updated },
    transfers: withoutFinishedDownloads(state.transfers, message),
  }
}

/**
 * A message's finished downloads, dropped once the message itself is announced: from then on its
 * `availability` says what they left, and a report kept past that would outlive an eviction.
 */
function withoutFinishedDownloads(
  transfers: SessionState['transfers'],
  message: Message,
): SessionState['transfers'] {
  const own = transfers[message.id]
  if (own === undefined) return transfers
  const finished = message.attachments
    .map((a) => transferKey('download', a.index))
    .filter((key) => own[key]?.state === 'done')
  if (finished.length === 0) return transfers
  const kept = { ...own }
  for (const key of finished) delete kept[key]
  return { ...transfers, [message.id]: kept }
}

/**
 * An older page in front of what is already loaded.
 *
 * A concatenation and nothing else: the page was asked for from before the oldest message the
 * window holds, and both come from libsession in the order it reads them out, so joining them
 * is the whole operation.
 */
export function mergePages(older: Message[], previous: Message[]): Message[] {
  if (previous.length === 0) return older
  if (older.length === 0) return previous
  return [...older, ...previous]
}
