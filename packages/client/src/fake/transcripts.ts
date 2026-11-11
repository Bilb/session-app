import { set } from './attachments'
import { FakeSessionClient } from './FakeSessionClient'
import { ensureDm, type FakeSetup, type FixtureName } from './fixtures'
import { FakeWorld, resetFakeIds } from './world'

type Line = readonly ['in' | 'out', string] | readonly ['in', string, 'file']

/** Each peer's conversation, oldest first. The last seeded is the newest, so it lists first. */
const TRANSCRIPTS: readonly (readonly [FixtureName, readonly Line[]])[] = [
  [
    'Dracula',
    [
      ['in', 'Good evening'],
      ['out', 'Evening'],
      ['in', 'Do you have the keys to the cellar?'],
      ['out', 'On the hook by the door'],
      ['in', 'Splendid'],
    ],
  ],
  [
    'Charlie',
    [
      ['out', 'Lunch tomorrow?'],
      ['in', 'Sure, where?'],
      ['out', 'The place on the corner'],
      ['in', 'Noon works'],
      ['out', 'See you then'],
    ],
  ],
  [
    'Bob',
    [
      ['in', 'Are we still on for Thursday?'],
      ['out', 'Yes, 7pm'],
      ['in', 'Here is the booking', 'file'],
      ['out', 'Thanks'],
      ['in', 'See you there'],
    ],
  ],
]

/**
 * Alice with three conversations of a few messages each, one of them carrying a file: what moving
 * through a transcript by keyboard needs, a message with controls of its own among plain ones.
 */
export function transcripts(): FakeSetup {
  resetFakeIds()
  const world = new FakeWorld()
  const self = world.account('Alice')
  for (const [name, lines] of TRANSCRIPTS) {
    const peer = world.account(name)
    ensureDm(self, peer, world)
    ensureDm(peer, self, world)
    for (const [direction, body, file] of lines) {
      if (file !== undefined) self.deliverFrom(peer, body, world.now(), set(['pdf']))
      else if (direction === 'in') peer.send(self.sessionId, body)
      else self.send(peer.sessionId, body)
      world.settle()
    }
  }
  return { world, clients: { [self.displayName]: new FakeSessionClient(self, world) } }
}
