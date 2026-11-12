import type {
  AttachmentRef,
  AttachmentTransfer,
  Conversation,
  ConversationId,
  ListPlacement,
  Message,
  SessionEvent,
} from '@session/client'

import type { AttachmentTransferState, ListName, MessageWindow, SessionState } from './types'
import { transferKey } from './types'

/**
 * The whole projection, as one pure function.
 *
 * Every event carries complete state, so this only ever replaces - it never merges a delta
 * or goes back to ask for the rest. That is what makes replaying the same event twice
 * harmless.
 *
 * A conversation's position is the one relative thing: a placement puts a row after another, so
 * the lists stay right only when every event lands, in order, on top of lists read earlier on the
 * same stream. When one cannot be applied, `listsOutOfStep` says so and the store reads that
 * list again.
 *
 * The objects the bridge hands over are stored as they are: this rebuilds the containers on the
 * path to a change (a map, an id array) and nothing inside them.
 */
export function applyEvent(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'conversation-added':
    case 'conversation-updated':
      return placeConversation(state, event.conversation, event.placement)

    case 'conversation-removed':
      return removeConversation(state, event.conversationId)

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

    case 'network-status-changed':
      return state.networkStatus === event.status
        ? state
        : { ...state, networkStatus: event.status }

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
 *
 * An upload is kept only while its message is `uploading`. libsession reports a file that fails
 * at once before the send has an id to report it by, so the bridge holds that report until after
 * the message has already been announced failed, and the failure is the message's to say.
 */
function recordTransfer(
  state: SessionState,
  event: Extract<SessionEvent, { type: 'attachment-progress' }>,
): SessionState {
  const message = loadedMessage(state, event.messageId)
  if (message === undefined) return state
  if (event.transfer === 'upload' && message.sendState !== 'uploading') return state

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

/** The message as a loaded window holds it, which is what makes a report worth keeping. */
function loadedMessage(state: SessionState, messageId: number): Message | undefined {
  for (const window of Object.values(state.histories)) {
    if (!window.ready) continue
    const message = window.messages.find((m) => m.id === messageId)
    if (message !== undefined) return message
  }
  return undefined
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
 * Takes the row out of whichever list holds it and puts it where the placement says.
 *
 * Both lists are searched rather than the placement's `from`, which is where libsession last
 * *reported* the row: a row the app read with `getConversations` and has not heard about since
 * is one libsession never reported, so its `from` is `none` while the app holds it.
 *
 * An `after` this store does not hold has no right answer, and appending would leave the row
 * somewhere plausible and wrong with nothing to correct it. It is appended all the same, so it
 * is not lost meanwhile, and the list is flagged for the store to read again.
 */
function placeConversation(
  state: SessionState,
  conversation: Conversation,
  { to, after }: ListPlacement,
): SessionState {
  const conversations = without(state.conversations, conversation.id)
  const requests = without(state.requests, conversation.id)
  if (to === 'none') return { ...state, conversations, requests }

  const lists: Record<ListName, Conversation[]> = { conversations, requests }
  const list = lists[to]
  const at = after === undefined ? 0 : list.findIndex((c) => c.id === after) + 1
  const found = at > 0 || after === undefined
  const placed = found
    ? [...list.slice(0, at), conversation, ...list.slice(at)]
    : [...list, conversation]

  return {
    ...state,
    ...lists,
    [to]: placed,
    listsOutOfStep: found ? state.listsOutOfStep : { ...state.listsOutOfStep, [to]: true },
  }
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
    transfers: withoutSettledTransfers(state.transfers, message),
  }
}

/**
 * A message's finished downloads, dropped once the message itself is announced: from then on its
 * `availability` says what they left, and a report kept past that would outlive an eviction.
 *
 * Its uploads go too once it is announced in any state but `uploading`: they were one attempt's,
 * `uploaded` says what that attempt left, and a retry reports its own from the start.
 */
function withoutSettledTransfers(
  transfers: SessionState['transfers'],
  message: Message,
): SessionState['transfers'] {
  const own = transfers[message.id]
  if (own === undefined) return transfers
  const uploadsOver = message.sendState !== 'uploading'
  const finished = message.attachments.flatMap((a) => {
    const download = transferKey('download', a.index)
    const upload = transferKey('upload', a.index)
    return [
      ...(own[download]?.state === 'done' ? [download] : []),
      ...(uploadsOver && upload in own ? [upload] : []),
    ]
  })
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
