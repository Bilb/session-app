/**
 * The contract, run against the fake.
 *
 * The same suite runs against the real addon in packages/bridge-node once that exists, so
 * the fake cannot drift away from the thing it stands in for without this failing.
 */

import {
  FakeSessionClient,
  friends,
  friendsWithAttachments,
  newcomer as newcomerFixture,
  strangers,
  unopenable,
  type FakeWorld,
} from '@session/client/fake'
import type { Attachment, SessionClient } from '@session/client'
import { describe, expect, it } from 'vitest'

import { runSessionClientContract, type ContractHarness } from '#src/index'

const ARRIVING_IMAGE: Attachment = {
  index: 0,
  contentType: 'image/jpeg',
  filename: 'arriving.jpg',
  sizeBytes: 150_000,
  voiceMessage: false,
  width: 1200,
  height: 900,
  hasPreview: false,
  hasThumbnail: false,
  uploaded: true,
  availability: 'absent',
  fetchDoneBytes: 0,
  fetchTotalBytes: 0,
}

/** The fake's clock is manual, so settling is synchronous and cannot race. */
function settleWith(world: FakeWorld): () => Promise<void> {
  return () => {
    world.settle()
    return Promise.resolve()
  }
}

const harness: ContractHarness = {
  friends() {
    const { world, clients } = friends(['Alice', 'Bob'])
    const alice = clients['Alice']
    const bob = clients['Bob']
    if (!alice || !bob) throw new Error('fixture did not produce both clients')
    return Promise.resolve({
      alice,
      bob,
      aliceId: world.account('Alice').sessionId,
      bobId: world.account('Bob').sessionId,
      settle: settleWith(world),
    })
  },

  strangers() {
    const { world, clients } = strangers(['Alice', 'Bob'])
    const alice = clients['Alice']
    const bob = clients['Bob']
    if (!alice || !bob) throw new Error('fixture did not produce both clients')
    return Promise.resolve({
      alice,
      bob,
      bobId: world.account('Bob').sessionId,
      settle: settleWith(world),
    })
  },

  async newcomer() {
    const { clients } = newcomerFixture()
    const client = Object.values(clients)[0]
    if (!client) throw new Error('fixture did not produce a client')
    // The fake's own phrase, which is the only one it can be asked to agree is genuine.
    return { client, phrase: await client.getSeedMnemonic() }
  },

  unopenable() {
    const { clients } = newcomerFixture()
    const client = Object.values(clients)[0]
    if (!client) throw new Error('fixture did not produce a client')
    return Promise.resolve(unopenable(client, 'file is not a database'))
  },

  withAttachment(options = {}) {
    const { world, clients } = friendsWithAttachments(['Alice', 'Bob'], {
      sets: [options.expired === true ? 'expired' : 'pictures'],
    })
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    const conversationId = world.account('Bob').sessionId
    const account = world.account('Alice')
    const withOne = account.messages(conversationId).find((m) => m.attachments.length > 0)
    if (!withOne) throw new Error('fixture did not seed an attachment')
    return Promise.resolve({
      client: alice,
      conversationId,
      messageId: withOne.id,
      index: 0,
      settle: settleWith(world),
      receiveImage: () =>
        Promise.resolve(
          account.deliverFrom(world.account('Bob'), 'One more', world.now(), [ARRIVING_IMAGE]).id,
        ),
    })
  },

  restart(client: SessionClient) {
    if (!(client instanceof FakeSessionClient)) {
      throw new Error('the fake harness can only restart a fake client')
    }
    return Promise.resolve(client.restart())
  },
}

describe('fake', () => {
  runSessionClientContract(harness, { describe, it, expect })
})
