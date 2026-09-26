import { applyEvent, emptyState, type SessionState } from '@session/state'
import { afterAll, it } from 'vitest'

import { conversationListFrame, makeCorpus, messageAddedFrame } from './fixtures'
import { ms, report, table, time } from './measure'
import { deliverOne, loopback, type Loopback } from './pipeline'

/**
 * Where the JavaScript thread's time goes, stage by stage.
 *
 * Tier one of the benchmark plan: no bridge, no device, no Electron. It asked whether the
 * serialisation was the expensive part or everything downstream of it, and the answer is why
 * there is no serialisation left to measure - the shim builds the structs the facade hands on.
 * What remains is everything the wire format could never have reached, which is the half that
 * decides whether a list feels immediate. Printed rather than asserted, because the only numbers
 * worth holding a build to are ones taken on the slowest device that ships, and this runs on
 * whatever the developer happens to have.
 */

const pipe: Loopback = loopback()
afterAll(() => {
  pipe.close()
})

it('conversation list: where the time goes', () => {
  const rows: string[][] = []

  for (const n of [100, 500, 1000, 5000]) {
    const { conversations } = makeCorpus({ conversations: n, messages: 0 })
    const frame = conversationListFrame(conversations)

    // No parse stage: the frame arrives as the struct the shim built. What is left in `facade`
    // is the routing to listeners, which used to be inseparable from the decode in front of it.
    const facade = time('facade', () => {
      pipe.push(frame)
      pipe.drain()
    })

    const event = deliverOne(pipe, frame)
    const project = time('project', () => {
      applyEvent(emptyState, event)
    })

    // There is no select stage any more. useConversations() used to rebuild the visible array
    // from an order array and an index on every store notification; the state holds the list
    // libsession sent, so the hook returns it and there is nothing to measure.
    const total = facade.median + project.median

    rows.push([
      String(n),
      ms(facade.median),
      ms(project.median),
      ms(total),
      ms(facade.p95 + project.p95),
      total === 0 ? '-' : `${((facade.median / total) * 100).toFixed(0)}%`,
    ])
  }

  report(
    '\n\n== CONVERSATION LIST ==  one conversation-list-replaced, milliseconds, median\n\n' +
      table(rows, ['rows', 'facade', 'project', 'TOTAL', 'p95', 'deliver%']) +
      '\n' +
      '  facade    routing one frame to its listeners; no decode is left in front of it\n' +
      '  project   applyEvent - which for a whole list is now the assignment of it\n' +
      '  deliver%  the share still spent getting the frame there rather than using it\n',
  )
})

it('one new message arriving in a transcript that is already loaded', () => {
  const rows: string[][] = []

  for (const n of [50, 200, 1000, 3000, 10000]) {
    const { conversations, messages } = makeCorpus({ conversations: 1, messages: n })
    const conversationId = conversations[0]?.id as string

    const state: SessionState = {
      ...emptyState,
      histories: {
        [conversationId]: {
          ready: true,
          messages,
          exhausted: true,
          fetching: false,
        },
      },
    }

    const last = messages[messages.length - 1]
    if (!last) throw new Error('no fixture message')
    const frame = messageAddedFrame({
      ...last,
      id: n + 1,
      timestamp: last.timestamp + 1000,
    })

    const facade = time('facade', () => {
      pipe.push(frame)
      pipe.drain()
    })
    const event = deliverOne(pipe, frame)
    const project = time('project', () => {
      applyEvent(state, event)
    })

    rows.push([
      String(n),
      ms(facade.median),
      ms(project.median),
      ms(project.p95),
      ms(facade.median + project.median),
    ])
  }

  report(
    '\n\n== ONE NEW MESSAGE ==  the payload is a single message however long the transcript is\n\n' +
      table(rows, ['loaded', 'deliver', 'project', 'proj p95', 'TOTAL']) +
      '\n' +
      '  The payload does not grow with the transcript. If `project` does, the cost is in\n' +
      '  applyEvent and nothing about the bridge can reach it.\n',
  )
})

it('account ids: what a page of messages spends on identity', () => {
  const rows: string[][] = []

  for (const [label, authors] of [
    ['DM (2 authors)', 2],
    ['small group (10)', 10],
    ['large group (100)', 100],
  ] as const) {
    const n = 500
    const { messages } = makeCorpus({ conversations: 1, messages: n, authorCount: authors })

    const idBytes = messages.reduce((sum, m) => sum + m.author.length, 0)
    const total = messages.reduce((sum, m) => sum + m.author.length + m.body.length + 24, 0)
    const unique = new Set(messages.map((m) => m.author)).size

    rows.push([
      label,
      String(n),
      String(unique),
      (idBytes / 1024).toFixed(1),
      (total / 1024).toFixed(1),
      `${((idBytes / total) * 100).toFixed(0)}%`,
    ])
  }

  report(
    '\n\n== ACCOUNT IDS ==  500 messages, characters spent on identity\n\n' +
      table(rows, ['shape', 'msgs', 'uniq', 'id KB', 'total KB', 'id %']) +
      '\n' +
      '  id %  share of a message page that is account ids, as hex strings. Still repeated\n' +
      '        per row on the typed bridge - as a string rather than as bytes.\n',
  )
})
