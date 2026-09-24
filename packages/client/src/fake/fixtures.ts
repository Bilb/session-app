import type { Attachment } from '@session/bridge-types'

import type { SessionClient } from '../types'

import { FakeSessionClient } from './FakeSessionClient'
import { FakeWorld, resetFakeIds, type FakeAccount } from './world'

/**
 * Gives `self` a conversation with `peer` without announcing it.
 *
 * A fixture is meant to look like state that was already there when the app started, so it
 * seeds quietly; the events a test cares about are the ones it causes itself.
 */
function ensureDm(self: FakeAccount, peer: FakeAccount, world: FakeWorld, request = false): void {
  if (self.get(peer.sessionId)) return
  self.upsertConversation(
    {
      id: peer.sessionId,
      kind: 'dm',
      displayName: peer.displayName,
      lastActivity: world.now(),
      priority: 0,
      unreadCount: 0,
      markedUnread: false,
      request,
      awaitingApproval: false,
      noteToSelf: false,
      blocked: false,
    },
    { announce: false },
  )
}

/**
 * Names are deliberately not substrings of one another: a test that looks up a row by the
 * text on screen must not match two of them. (Alice/Alicia would; Alice/Bob will not.)
 */
export const FIXTURE_NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'Dracula',
  'Emily',
  'Frank',
  'Grace',
  'Hugo',
] as const

export type FixtureName = (typeof FIXTURE_NAMES)[number]

/**
 * Pictures only, so the message is gallery-viewable and draws as pictures.
 *
 * Dimensions are the sender's and are what the placeholder is laid out from, so they are set:
 * without them a transcript jumps as each one lands.
 *
 * `hasPreview` is set because no 1.x client sends a ThumbHash at all, so this fixture is the only
 * way to see the placeholder before something learns to encode them. The fake's preview door
 * answers with a flat colour: what it exercises is the route, not the decoder.
 */
const SEEDED_PICTURES: Attachment[] = [
  {
    index: 0,
    contentType: 'image/jpeg',
    filename: 'harbour.jpg',
    hasPreview: true,
    size: 2_411_724,
    voiceMessage: false,
    width: 1600,
    height: 1200,
    uploaded: true,
    availability: 'absent',
    fetchDone: 0,
    fetchTotal: 0,
  },
  {
    index: 1,
    contentType: 'image/png',
    filename: 'ferry.png',
    hasPreview: true,
    size: 812_004,
    voiceMessage: false,
    width: 1200,
    height: 1600,
    uploaded: true,
    availability: 'absent',
    fetchDone: 0,
    fetchTotal: 0,
  },
]

/**
 * One picture and one file, which libsession's rule makes *not* gallery-viewable: a message is
 * only shown as pictures when every attachment is one. This is what draws the file form.
 */
const SEEDED_FILES: Attachment[] = [
  {
    index: 0,
    contentType: 'image/jpeg',
    filename: 'receipt.jpg',
    hasPreview: true,
    size: 96_500,
    voiceMessage: false,
    width: 900,
    height: 1200,
    uploaded: true,
    availability: 'absent',
    fetchDone: 0,
    fetchTotal: 0,
  },
  {
    index: 1,
    contentType: 'application/pdf',
    filename: 'itinerary.pdf',
    size: 184_320,
    voiceMessage: false,
    hasPreview: false,
    uploaded: true,
    availability: 'absent',
    fetchDone: 0,
    fetchTotal: 0,
  },
]

/**
 * More attachments than a message draws in the transcript.
 *
 * Thirteen, so the eighth row is followed by "Show All" and the sheet has five to add. A mixed
 * set, because the rule that sends a message to the list is one plain file - and the case worth
 * having a fixture for is the one no composer can produce.
 */
const SEEDED_MANY: Attachment[] = Array.from({ length: 13 }, (_, at) => ({
  index: at,
  ...(at === 12
    ? { contentType: 'application/pdf', filename: 'contact-sheet.pdf' }
    : {
        contentType: 'image/jpeg',
        filename: `roll-${String(at + 1).padStart(2, '0')}.jpg`,
        width: 1200,
        height: 900,
      }),
  hasPreview: at !== 12,
  size: 120_000 + at * 4_000,
  voiceMessage: false,
  uploaded: true,
  availability: 'absent',
  fetchDone: 0,
  fetchTotal: 0,
}))

/**
 * The average colour of each photo the dev media folder holds, as a real BlurHash.
 *
 * Encoded from the files by libsession's own encoder rather than invented, so what the fake draws
 * before a photograph arrives is what a recipient would actually be sent -- including the format's
 * limits, which a downscaled thumbnail would flatter.
 *
 * Index N here is `unsplash-NN.jpg` there, and `photoNumber` is what keeps the two in step.
 */
export const PHOTO_THUMBHASHES: readonly string[] = [
  'd5280a3d8a8577777f76778286e7888c8775705807', // 01
  '18f81105807978776f86887a777788847780c9eaf5', // 02
  '1af81d0d827677877f77778a77887887556062b5f6', // 03
  '96f8050d8405a7877e8678869935a977047f32d405', // 04
  'e2f7151d828877877f87888a877888887b409d07d5', // 05
  '15080a0d820657b79488897487aa86900688766068', // 06
  '15290a258477367673888880878a8877b776704a08', // 07
  '1f081a05808777887f877786877887880000000000', // 08
  '2718161d868778889f877875787787878c79c07707', // 09
  'a8e71525848787778f87877678888877887f8888f7', // 10
  '18290e1d82049a587979965c98868697079bfbd09e', // 11
  '1ff80905800aac873f9877548897798790b02904a5', // 12
  'aa390e2d869b88777f88777776a78783686f548405', // 13
  'af081625847788778f7887748778788977807b07b8', // 14
  '0c080a05809c7877bf798799779778780000000000', // 15
  'e2f7050d822396984f54897f56b895566770750557', // 16
  '1af9091d806988768f88788d87a87776776026bb04', // 17
  'd9281215848776877f86776a8888888890890c0baa', // 18
  '5fd7091d821a79787f8b87767c398789b670552d06', // 19
  'e0e7051584368877687776908a9994727770740757', // 20
  '28081615827578788f8878877877877769508a05d4', // 21
  'a1e71505807978878f8777678878887863fc15f64b', // 22
  '1f18060d82706486818b79897688a884666fe4a107', // 23
  '60e7090d82d14e606faa579a99e899963d8ecfd4f8', // 24
  '1808060580975998687aa6782978777f0000000000', // 25
  '5844111d965887788f7788798897778888808e0868', // 26
  '6a080a0d827667988f87777087988878d77f6205c7', // 27
  '0d080a0580069888789876817b776889805b05c103', // 28
  '61491a15846579787f878889788888777692700709', // 29
  '90e7050d82488745976a77508a5767994795600309', // 30
]

type Kind = 'image' | 'video' | 'pdf' | 'zip' | 'sheet' | 'audio'

const TYPES: Record<Kind, { contentType: string; extension: string }> = {
  image: { contentType: 'image/jpeg', extension: 'jpg' },
  video: { contentType: 'video/mp4', extension: 'mp4' },
  pdf: { contentType: 'application/pdf', extension: 'pdf' },
  zip: { contentType: 'application/zip', extension: 'zip' },
  sheet: { contentType: 'application/vnd.ms-excel', extension: 'xlsx' },
  audio: { contentType: 'audio/mpeg', extension: 'mp3' },
}

/**
 * One attachment of a showcase message.
 *
 * `hashed` is the axis worth being able to turn off: every 1.x client sends no BlurHash at all,
 * so the flat surface and its glyph is the permanent case and has to be as easy to look at as
 * the coloured one.
 */
function showpiece(
  index: number,
  kind: Kind,
  photo: number,
  options: { hashed?: boolean; expired?: boolean } = {},
): Attachment {
  const { contentType, extension } = TYPES[kind]
  const picture = kind === 'image' || kind === 'video'
  return {
    index,
    contentType,
    // The number is load-bearing on a picture: the dev bridge reads it back out to decide which
    // file to serve, which is what makes the hash below describe the photo that arrives.
    filename: picture
      ? `unsplash-${String(photo).padStart(2, '0')}.${extension}`
      : `${kind}-${String(index + 1).padStart(2, '0')}.${extension}`,
    // Spread so a set does not report one bar's worth of progress four times over.
    size: 180_000 + index * 420_000,
    voiceMessage: false,
    ...(picture ? { width: 1600, height: 1200 } : {}),
    hasPreview: picture && options.hashed !== false,
    uploaded: true,
    availability: options.expired === true ? 'notFound' : 'absent',
    fetchDone: 0,
    fetchTotal: 0,
  }
}

/**
 * A running number over the whole showcase, so no two pictures in it are the same photo.
 *
 * Reset with the fixture rather than per message: thirty files and rather more attachments than
 * that, so it wraps - but a wrap between messages is much less noticeable than two identical
 * tiles side by side.
 */
let nextPhoto = 0

function set(kinds: Kind[], options: { hashed?: boolean; expired?: boolean } = {}): Attachment[] {
  return kinds.map((kind, index) => {
    const picture = kind === 'image' || kind === 'video'
    if (picture) nextPhoto += 1
    return showpiece(index, kind, ((nextPhoto - 1) % PHOTO_THUMBHASHES.length) + 1, options)
  })
}

const image = (n: number): Kind[] => Array.from({ length: n }, () => 'image' as const)

/**
 * Every shape a message's attachments can take, in one conversation.
 *
 * For looking at rather than for asserting on: the e2e suite runs against `friends`, whose three
 * messages are chosen to be the fewest that reach each code path. This is the opposite - one
 * message per case, so a pass over the transcript is a pass over the design.
 *
 * The order is the album's counts first, then the mixes that force a list, then the states a
 * message can be in that have nothing to do with what is attached.
 */
export function showcase(names: readonly [FixtureName, FixtureName] = ['Alice', 'Bob']): FakeSetup {
  resetFakeIds()
  nextPhoto = 0
  const world = new FakeWorld()
  const [firstName, secondName] = names
  const first = world.account(firstName)
  const second = world.account(secondName)

  ensureDm(first, second, world)
  ensureDm(second, first, world)

  const messages: Array<[string, Attachment[]]> = [
    // The album, at every count its layout has a shape for, and one past the cap.
    ['One picture', set(image(1))],
    ['Two, as halves', set(image(2))],
    ['Three: one big, two stacked', set(image(3))],
    ['Four, an even grid', set(image(4))],
    ['Five: one big beside a quad', set(image(5))],
    ['Twelve, so seven are behind the count', set(image(12))],

    // The same shapes with nothing to draw before the bytes, which is every 1.x sender.
    ['Three with no hash to draw', set(image(3), { hashed: false })],
    ['Five with no hash to draw', set(image(5), { hashed: false })],

    // A video is a tile too, so these stay galleries.
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

    // Nothing to do with the count: a file the server will not hand out again.
    ['One of these is gone', set(['pdf'], { expired: true })],
  ]

  for (const [body, attachments] of messages) {
    // Delivered rather than sent: attaching is not in the protocol, so the only way one exists is
    // arriving. Nothing is fetched - the conversation has not been asked yet.
    first.deliverFrom(second, body, world.now(), attachments)
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

export interface FakeSetup {
  world: FakeWorld
  clients: Record<string, SessionClient>
}

/**
 * One client with no identity yet: the state the app is in on first launch.
 *
 * The only fixture that reaches the onboarding screens. The app chooses between onboarding and
 * everything else on `haveAccount`, so a world where every account already has one leaves that
 * whole branch unreachable -- which is why this exists separately rather than as an option on
 * `solo`: there are no peers, no conversations and no history to seed, because there is nobody to
 * seed them for yet.
 */
export function newcomer(name: FixtureName = 'Alice'): FakeSetup {
  resetFakeIds()
  const world = new FakeWorld()
  const self = world.account(name, { haveAccount: false })
  return { world, clients: { [self.displayName]: new FakeSessionClient(self, world) } }
}

/**
 * Two accounts that already know each other, with a little history.
 *
 * This is the shape the seeded states in the e2e suite take, so a flow written against the
 * fake reads the same as the one written against a real seeded swarm.
 */
export function friends(
  names: readonly [FixtureName, FixtureName] = ['Alice', 'Bob'],
  options: { history?: number; attachments?: boolean } = {},
): FakeSetup {
  resetFakeIds()
  const world = new FakeWorld()
  const [firstName, secondName] = names
  const first = world.account(firstName)
  const second = world.account(secondName)

  ensureDm(first, second, world)
  ensureDm(second, first, world)

  const history = options.history ?? 0
  for (let i = 0; i < history; i += 1) {
    const sender = i % 2 === 0 ? first : second
    const recipient = sender === first ? second : first
    sender.send(recipient.sessionId, `Message ${i + 1}`)
    world.settle()
  }

  // Delivered rather than sent: sending an attachment is not in the protocol, so the only way one
  // exists is arriving. Nothing is fetched for either - the conversation has not been asked yet.
  // Three messages: an album, a mixed set the list draws, and one longer than the transcript
  // will hold. Each shape is chosen from the set rather than set by a flag, so a fixture missing
  // one leaves that shape undrawn.
  if (options.attachments ?? true) {
    first.deliverFrom(second, 'Here are the photos', world.now(), SEEDED_PICTURES)
    world.settle()
    first.deliverFrom(second, 'And the paperwork', world.now(), SEEDED_FILES)
    world.settle()
    first.deliverFrom(second, 'The whole roll', world.now(), SEEDED_MANY)
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

/** One account with a populated, already-approved conversation list. */
export function solo(name: FixtureName = 'Alice', peers = 3): FakeSetup {
  resetFakeIds()
  const world = new FakeWorld()
  const self = world.account(name)
  const start = FIXTURE_NAMES.indexOf(name)

  for (let i = 0; i < peers; i += 1) {
    const peerName = FIXTURE_NAMES[(start + 1 + i) % FIXTURE_NAMES.length] ?? 'Bob'
    const peer = world.account(peerName)
    ensureDm(peer, self, world)
    ensureDm(self, peer, world)
    peer.send(self.sessionId, `Hello from ${peer.displayName}`)
    world.settle()
  }

  return { world, clients: { [name]: new FakeSessionClient(self, world) } }
}

/** Someone has written to us and has not been approved yet: the row sits in requests. */
export function strangers(
  names: readonly [FixtureName, FixtureName] = ['Alice', 'Bob'],
): FakeSetup {
  resetFakeIds()
  const world = new FakeWorld()
  const [firstName, secondName] = names
  const first = world.account(firstName)
  const second = world.account(secondName)

  // The sender knows who they wrote to; the recipient learns of them on delivery, which is
  // what puts the row in the request list.
  ensureDm(second, first, world)
  second.send(first.sessionId, 'Hi, can we talk?')
  world.settle()

  return {
    world,
    clients: {
      [firstName]: new FakeSessionClient(first, world),
      [secondName]: new FakeSessionClient(second, world),
    },
  }
}

/**
 * One account with an arbitrarily large, already-approved conversation list.
 *
 * `solo` cycles the eight named fixtures and so tops out at eight peers, which is the right size
 * for a flow test and useless for a measurement: the costs worth knowing - the projection re-sorting
 * the list, React mounting every row - only appear at a scale no hand-written fixture reaches.
 * Names here are generated rather than drawn from FIXTURE_NAMES for the same reason.
 */
export function crowd(options: { peers: number; history?: number; name?: FixtureName }): FakeSetup {
  resetFakeIds()
  const world = new FakeWorld()
  const self = world.account(options.name ?? 'Alice')
  const history = options.history ?? 1

  for (let i = 0; i < options.peers; i += 1) {
    const peer = world.account(`Peer ${String(i).padStart(4, '0')}`)
    ensureDm(peer, self, world)
    ensureDm(self, peer, world)
    for (let m = 0; m < history; m += 1) {
      peer.send(self.sessionId, `Message ${String(m + 1)} from ${peer.displayName}`)
    }
  }
  // Settled once at the end rather than per message: settling is O(the whole world), so doing it
  // inside the loop makes seeding quadratic and a thousand peers never finish.
  world.settle()

  return { world, clients: { [self.displayName]: new FakeSessionClient(self, world) } }
}
