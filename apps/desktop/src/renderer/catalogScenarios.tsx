import type { ConversationId, Message } from '@session/client'
import { DetachedMessages, MessageRow } from '@session/screens'
import { SessionStoreProvider, transferKey, type SessionStore } from '@session/state'
import { ModalStackProvider, ToastProvider } from '@session/ui'
import { defineStory, type AnyStory } from '@session/ui/catalog'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { store } from './store'

/** A row is a message of the `showcase` fixture, found by its body. */
interface ScenarioRow {
  body: string
}

/**
 * What a few rows' messages are put through before any page draws, by body. Each is its own
 * message, never one another page draws at rest: the store is shared by every page.
 */
const PREPARE: Record<string, 'downloaded' | 'downloading' | 'downloadFailed'> = {
  'Two, as halves': 'downloaded',
  'Four, an even grid': 'downloading',
  'Five: one big beside a quad': 'downloadFailed',
}

const POLL_MS = 50

async function until(ready: () => boolean): Promise<void> {
  while (!ready()) await new Promise((resolve) => setTimeout(resolve, POLL_MS))
}

interface Scenario {
  conversationId: ConversationId
  messageIds: Map<string, number>
}

async function prepare(session: SessionStore): Promise<Scenario> {
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

let prepared: Promise<Scenario> | null = null

const ScenarioContext = createContext<Scenario | null>(null)

function ScenarioMessage({ body }: ScenarioRow) {
  const scenario = useContext(ScenarioContext)
  const messageId = scenario?.messageIds.get(body)
  if (scenario === null || messageId === undefined) return null
  return <MessageRow conversationId={scenario.conversationId} messageId={messageId} index={0} />
}

/** The store, the showcase loaded into it, and what a message row asks of its screen. */
export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  useEffect(() => {
    prepared ??= prepare(store)
    prepared.then(setScenario, (error: unknown) => {
      console.error('[catalog] preparing the showcase failed:', error)
    })
  }, [])
  if (scenario === null) return null
  return (
    <SessionStoreProvider store={store}>
      <DetachedMessages conversationId={scenario.conversationId}>
        <ScenarioContext.Provider value={scenario}>
          <ModalStackProvider>
            <ToastProvider>{children}</ToastProvider>
          </ModalStackProvider>
        </ScenarioContext.Provider>
      </DetachedMessages>
    </SessionStoreProvider>
  )
}

const MESSAGE_WIDTH = 420

const message = (story: string, bodies: readonly string[], sensitive: AnyStory['sensitive']) =>
  defineStory<ScenarioRow>({
    component: 'message',
    story,
    width: MESSAGE_WIDTH,
    sensitive,
    variants: Object.fromEntries(bodies.map((body) => [body, { body }])),
    render: (row) => <ScenarioMessage {...row} />,
  })

export const SCENARIOS: readonly AnyStory[] = [
  message(
    'albumShapes',
    [
      'One picture',
      'Three: one big, two stacked',
      'Twelve, so seven are behind the count',
      'Three with no hash to draw',
      'Five with no hash to draw',
    ],
    { responsive: true },
  ),
  message(
    'albumStates',
    ['Two, as halves', 'Four, an even grid', 'Five: one big beside a quad', 'Thirty-two'],
    {},
  ),
  message(
    'files',
    [
      'A clip on its own',
      'Pictures and a clip',
      'Paperwork only',
      'A recording',
      'The whole roll',
      'One of these is gone',
      'Four of these five are gone',
    ],
    { rtl: true },
  ),
]
