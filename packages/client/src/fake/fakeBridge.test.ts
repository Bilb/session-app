import { describe, expect, it } from 'vitest'

import { createSessionClient } from '../createSessionClient'
import type { SessionEvent } from '../types'
import { createFakeTransport } from './fakeBridge'
import { friends } from './fixtures'

/**
 * The fake, driven through the real codec and the real facade.
 *
 * This is the whole pipeline the apps use - encode, transport, decode, correlate - with
 * only the C++ missing. A break in any of those layers fails here rather than in an app.
 */
function connect() {
  const { world, clients } = friends(['Alice', 'Bob'])
  const alice = clients['Alice']
  if (!alice) throw new Error('fixture did not produce Alice')

  const client = createSessionClient(createFakeTransport(alice))
  const events: SessionEvent[] = []
  client.onEvent((event) => events.push(event))

  return { client, events, world, bobId: world.account('Bob').sessionId }
}

describe('the bridge protocol, end to end', () => {
  it('answers a request through the codec', async () => {
    const { client } = connect()
    const info = await client.getAccountInfo()
    expect(info.haveAccount).toBe(true)
    expect(info.displayName).toBe('Alice')
  })

  it('carries a conversation list across', async () => {
    const { client, bobId } = connect()
    const conversations = await client.getConversations()
    expect(conversations.map((c) => c.id)).toContain(bobId)
    expect(conversations[0]?.displayName).toBe('Bob')
  })

  it('sends, and reports the states that follow as events', async () => {
    const { client, events, world, bobId } = connect()

    const messageId = await client.sendMessage(bobId, { body: 'hello' })
    expect(messageId).toBeGreaterThan(0)

    const added = events.find((e) => e.type === 'message-added')
    expect(added?.type).toBe('message-added')
    if (added?.type !== 'message-added') throw new Error('unreachable')
    expect(added.message.body).toBe('hello')

    world.settle()

    const updates = events.filter((e) => e.type === 'message-updated')
    const last = updates[updates.length - 1]
    if (last?.type !== 'message-updated') throw new Error('unreachable')
    expect(last.message.sendState).toBe('sent')
  })

  it('turns a failure into a rejected promise with the message intact', async () => {
    const { client } = connect()
    await expect(client.getConversation('05nope')).rejects.toThrow(/No such conversation/)
  })

  it("keeps a message's numbers as numbers on the far side", async () => {
    const { client, world, bobId } = connect()
    await client.sendMessage(bobId, { body: 'hello' })
    world.settle()

    const messages = await client.getMessages(bobId)
    const message = messages[0]
    expect(typeof message?.id).toBe('number')
    expect(typeof message?.timestamp).toBe('number')
  })
})
