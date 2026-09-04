/**
 * What every SessionClient must do, whoever implements it.
 *
 * The fake runs this on every PR. The real addon runs the same scenarios offline, feeding
 * inbound messages through libsession's own test path rather than a network. When the two
 * disagree, one of them is wrong and the suite says which behaviour was expected — which is
 * the whole point: a fake nobody checks is a fake that quietly stops predicting anything.
 *
 * Written as a function of a harness so it can be handed either implementation.
 */

import type { Conversation, SessionClient, SessionEvent } from '@session/client'

export interface ContractHarness {
  /** Two clients that already know each other, with no history. */
  friends(): Promise<{
    alice: SessionClient
    bob: SessionClient
    aliceId: string
    bobId: string
    /** Lets whatever is in flight finish: a manual clock, or a real poll. */
    settle: () => Promise<void>
  }>
  /** A pair where bob has written to alice but alice has not approved. */
  strangers(): Promise<{
    alice: SessionClient
    bob: SessionClient
    bobId: string
    settle: () => Promise<void>
  }>
  /** Stops and restarts a client against the same data. */
  restart(client: SessionClient): Promise<SessionClient>
}

type Runner = (name: string, body: () => Promise<void> | void) => void

type TestFns = {
  describe: (name: string, body: () => void) => void
  it: Runner & { skip: Runner }
  expect: <T>(actual: T) => {
    // Declared as properties rather than methods so that pulling one off the matcher is
    // not read as an unbound `this`.
    toBe: (expected: unknown) => void
    toEqual: (expected: unknown) => void
    toBeDefined: () => void
    toBeUndefined: () => void
    toContain: (expected: unknown) => void
    toBeGreaterThan: (expected: number) => void
  }
}

function collect(client: SessionClient): { events: SessionEvent[]; stop: () => void } {
  const events: SessionEvent[] = []
  const stop = client.onEvent((event) => events.push(event))
  return { events, stop }
}

export interface ContractOptions {
  /**
   * Scenarios this implementation cannot satisfy, and why, keyed by title.
   *
   * A written reason rather than a flag, because the only honest use of this is a behaviour
   * libsession does not have yet — and the reason is what stops it becoming a way to make a
   * failing implementation look green. The skipped titles carry it into the test output.
   */
  unsupported?: Record<string, string>
}

export function runSessionClientContract(
  harness: ContractHarness,
  t: TestFns,
  options: ContractOptions = {},
): void {
  const { describe, expect } = t
  const unsupported = options.unsupported ?? {}
  const it: Runner = (name, body) => {
    const reason = unsupported[name]
    if (reason === undefined) t.it(name, body)
    else t.it.skip(`${name} — ${reason}`, body)
  }

  describe('SessionClient contract', () => {
    it('stores an outgoing message before it is sent', async () => {
      const { alice, bobId } = await harness.friends()
      const seen = collect(alice)

      const messageId = await alice.sendMessage(bobId, { body: 'hello' })

      // The row exists the moment the call resolves — which is why the app needs no
      // optimistic copy of its own to reconcile later.
      const added = seen.events.find((e) => e.type === 'message-added')
      expect(added).toBeDefined()
      if (added?.type !== 'message-added') throw new Error('unreachable')
      expect(added.message.id).toBe(messageId)
      expect(added.message.outgoing).toBe(true)
      expect(['pending', 'sending', 'uploading']).toContain(added.message.sendState)
      seen.stop()
    })

    it('reports the send reaching the network as an update, not a second message', async () => {
      const { alice, bobId, settle } = await harness.friends()
      const seen = collect(alice)

      const messageId = await alice.sendMessage(bobId, { body: 'hello' })
      await settle()

      const updates = seen.events.filter(
        (e) => e.type === 'message-updated' && e.message.id === messageId,
      )
      expect(updates.length).toBeGreaterThan(0)
      const last = updates[updates.length - 1]
      if (last?.type !== 'message-updated') throw new Error('unreachable')
      // A terminal state, not a particular one: offline — which is what the addon runs as,
      // with no swarm to reach — the send terminates in `failed`, and that is the same
      // contract. What this scenario is about is that it arrived as an update.
      expect(['sent', 'failed']).toContain(last.message.sendState)

      const added = seen.events.filter((e) => e.type === 'message-added')
      expect(added.length).toBe(1)
      seen.stop()
    })

    it('delivers to the other side', async () => {
      const { alice, bob, aliceId, settle } = await harness.friends()
      await alice.sendMessage((await bob.getAccountInfo()).sessionId ?? '', { body: 'ping' })
      await settle()

      const messages = await bob.getMessages(aliceId)
      expect(messages.map((m) => m.body)).toContain('ping')
    })

    it('carries the whole conversation on every change, never just an id', async () => {
      const { alice, bobId, settle } = await harness.friends()
      const seen = collect(alice)

      await alice.sendMessage(bobId, { body: 'hello' })
      await settle()

      const updated = seen.events.find((e) => e.type === 'conversation-updated')
      expect(updated).toBeDefined()
      if (updated?.type !== 'conversation-updated') throw new Error('unreachable')
      // A display can bind straight to this: it is the new row, not a hint to go and fetch.
      expect(updated.conversation.id).toBe(bobId)
      expect(updated.conversation.displayName).toBeDefined()
      seen.stop()
    })

    it('moves an approved request between the two lists', async () => {
      const { alice, bobId } = await harness.strangers()

      const before = await alice.getConversations()
      const requestsBefore = await alice.getMessageRequests()
      expect(before.some((c: Conversation) => c.id === bobId)).toBe(false)
      expect(requestsBefore.some((c: Conversation) => c.id === bobId)).toBe(true)

      const seen = collect(alice)
      await alice.approveConversation(bobId)

      // Approval arrives as an update, so both lists have to be re-sent for the row to
      // move: a display that only watched one of them would show it twice or not at all.
      expect(seen.events.some((e) => e.type === 'conversation-list-replaced')).toBe(true)
      expect(seen.events.some((e) => e.type === 'request-list-replaced')).toBe(true)

      const after = await alice.getConversations()
      const requestsAfter = await alice.getMessageRequests()
      expect(after.some((c: Conversation) => c.id === bobId)).toBe(true)
      expect(requestsAfter.some((c: Conversation) => c.id === bobId)).toBe(false)
      seen.stop()
    })

    it('pages history without duplicating a message at the seam', async () => {
      const { alice, bobId, settle } = await harness.friends()
      for (let i = 0; i < 5; i += 1) {
        await alice.sendMessage(bobId, { body: `m${i}` })
        await settle()
      }

      const newest = await alice.getMessages(bobId, { limit: 2 })
      expect(newest.length).toBe(2)

      const oldest = newest[0]
      if (!oldest) throw new Error('unreachable')
      const older = await alice.getMessages(bobId, {
        limit: 2,
        before: { timestamp: oldest.timestamp, id: oldest.id },
      })

      const overlap = older.filter((m) => newest.some((n) => n.id === m.id))
      expect(overlap.length).toBe(0)
    })

    it('leaves an interrupted send visible after a restart', async () => {
      const { alice, bobId } = await harness.friends()
      await alice.sendMessage(bobId, { body: 'in flight' })

      const restarted = await harness.restart(alice)
      const messages = await restarted.getMessages(bobId)
      const inFlight = messages.find((m) => m.body === 'in flight')

      expect(inFlight).toBeDefined()
      // libsession's send queue does not survive the process; a UI that has never seen
      // this state spins for ever after a crash.
      expect(['interrupted', 'sent', 'failed']).toContain(inFlight?.sendState)
    })

    it('clears a conversation by replacing its history, not by removing it', async () => {
      const { alice, bobId, settle } = await harness.friends()
      await alice.sendMessage(bobId, { body: 'hello' })
      await settle()

      const seen = collect(alice)
      await alice.deleteMessage((await alice.getMessages(bobId))[0]?.id ?? 0, 'here')
      expect(seen.events.some((e) => e.type === 'conversation-removed')).toBe(false)
      seen.stop()
    })

    it('rejects everything still waiting when it closes', async () => {
      const { alice, bobId } = await harness.friends()
      const pending = alice.sendMessage(bobId, { body: 'never' }).catch((error: unknown) => error)
      alice.close()

      const outcome = await pending
      // A promise that never settles would be worse than a rejection: nothing upstream
      // could tell the difference between "slow" and "gone".
      expect(typeof outcome === 'number' || outcome instanceof Error).toBe(true)
    })
  })
}
