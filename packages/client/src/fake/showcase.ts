import type { Attachment, SendState } from '@session/bridge-types'

import { image, resetPhotos, set } from './attachments'
import { ensureDm, type FakeSetup, type FixtureName } from './fixtures'
import { FakeSessionClient } from './FakeSessionClient'
import { FakeWorld, resetFakeIds } from './world'

/**
 * Every shape a message's attachments can take, in one conversation.
 *
 * For looking at rather than for asserting on: the e2e suite runs against `friends`, whose three
 * messages are chosen to be the fewest that reach each code path. This is the opposite - one
 * message per case, so a pass over the transcript is a pass over the design.
 *
 * The order is the album's counts first, then the mixes that force a list, then the states a
 * message can be in that have nothing to do with what is attached, then downloads caught running.
 */
export function showcase(names: readonly [FixtureName, FixtureName] = ['Alice', 'Bob']): FakeSetup {
  resetFakeIds()
  resetPhotos()
  const world = new FakeWorld()
  const [firstName, secondName] = names
  const first = world.account(firstName)
  const second = world.account(secondName)

  ensureDm(first, second, world)
  ensureDm(second, first, world)

  const messages: Array<[string, Attachment[]]> = [
    // The album at every count up to its cap, and past it. Every dev photograph is 4:3, so the
    // names say how rows of those fall; the catalog's album stories draw other shapes.
    ['One picture', set(image(1))],
    ['Two, one above the other', set(image(2))],
    ['Three: one above two', set(image(3))],
    ['Four in two rows', set(image(4))],
    ['Five: two above three', set(image(5))],
    ['Twelve, so seven are behind the count', set(image(12))],
    ['Thirty-two', set(image(32))],

    // The same shapes from a sender that supplied no ThumbHash, so nothing draws before the bytes.
    ['Three with no hash to draw', set(image(3), { hashed: false })],
    ['Five with no hash to draw', set(image(5), { hashed: false })],

    // A video is a file row until libsession has a still for it, so each of these is a list.
    ['A clip on its own', set(['video'])],
    ['Pictures and a clip', set(['image', 'image', 'video'])],
    ['Clips only', set(['video', 'video'])],

    // One plain file puts the whole set in a list, pictures included.
    ['A clip and its notes', set(['video', 'pdf'])],
    ['Pictures, a clip and the paperwork', set(['image', 'image', 'video', 'pdf'])],
    ['Paperwork only', set(['pdf', 'zip', 'sheet'])],
    ['One file', set(['pdf'])],
    ['A recording', set(['audio'])],

    // Longer than the transcript holds, so the list caps and the rest moves into a sheet.
    ['The whole roll', set([...image(13), 'pdf'])],

    // Sent as the sender's files, metadata and all: a thumbnail to look at, a file to export.
    ['Two photos sent as the originals', set(image(2), { original: true })],
    ['A photo sent as the original, and the paperwork', set(['image', 'pdf'], { original: true })],

    // Nothing to do with the count: a file the server will not hand out again.
    ['One of these is gone', set(['pdf'], { expired: true })],
    [
      'Four of these five are gone',
      set(['pdf', 'zip', 'sheet', 'audio', 'pdf'], { expired: (index) => index < 4 }),
    ],
  ]

  for (const [body, attachments] of messages) {
    // Nothing is fetched: the conversation has not been asked what to download.
    first.deliverFrom(second, body, world.now(), attachments)
    world.settle()
  }

  // A running download at each reading the footer's ring draws, received and ours alike: the
  // catalog's scenarios give each a transfer of its own. The first pair declares no sizes, so
  // nothing says how big its set is and the ring cannot read a share of it.
  const readings: Array<[string, boolean]> = [
    ['for the ring at 0 of 0', false],
    ['for the ring at 40%', true],
    ['for the ring at 95%', true],
  ]
  for (const [reading, sized] of readings) {
    first.deliverFrom(second, `A pair ${reading}`, world.now(), set(image(2), { sized }))
    world.settle()
  }
  for (const [reading, sized] of readings) {
    first.seedFromOtherDevice(
      second.sessionId,
      `Ours from another device, ${reading}`,
      set(image(2), { sized }),
    )
    world.settle()
  }

  // Ours, caught sending: what the composer's files become once the bridge can carry them.
  const sending: Array<[string, Attachment[], SendState, number]> = [
    [
      'Still uploading, one at a time',
      set(['image', 'pdf', 'video', 'image', 'zip']),
      'uploading',
      2,
    ],
    ['File 31 of 32 failed', set([...image(30), 'video', 'image']), 'failed', 30],
    ['Gallery whose 31st failed', set(image(32)), 'failed', 30],
    ['A file of this one went missing', set(['pdf', 'image']), 'unsendable', 1],
  ]
  for (const [body, attachments, sendState, uploaded] of sending) {
    first.seedSending(second.sessionId, body, attachments, sendState, uploaded)
    world.settle()
  }

  return {
    world,
    clients: {
      [firstName]: new FakeSessionClient(first, world),
      [secondName]: new FakeSessionClient(second, world),
    },
  }
}
