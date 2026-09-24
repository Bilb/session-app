import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Attachment, BridgeTransport, SessionClient } from '@session/client'
import {
  PHOTO_COLOURS,
  createFakeTransport,
  crowd,
  friends,
  newcomer,
  showcase,
} from '@session/client/fake'

import type { MediaSource } from '../media'
import { encodePng } from '../png'

/**
 * A one-pixel PNG, per attachment, in a colour derived from what it belongs to.
 *
 * Enough for the media scheme to be exercised end to end without a network: a test can assert
 * that a picture drew, and `dev:fake` shows something rather than a broken image. Deliberately
 * not a real photograph - a fixture that has to be looked at is a fixture nobody updates.
 */
function swatchPng(messageId: number, index: number): Uint8Array {
  const hue = (messageId * 37 + index * 89) % 360
  const [r, g, b] = hslToRgb(hue)
  return encodePng(1, 1, new Uint8Array([r, g, b, 255]))
}

function hslToRgb(hue: number): [number, number, number] {
  const section = hue / 60
  const x = Math.round(255 * (1 - Math.abs((section % 2) - 1)))
  const table: [number, number, number][] = [
    [255, x, 0],
    [x, 255, 0],
    [0, 255, x],
    [0, x, 255],
    [x, 0, 255],
    [255, 0, x],
  ]
  return table[Math.floor(section) % 6] ?? [255, 0, 0]
}

/**
 * The bridge, backed by the fake.
 *
 * This is a dev entry and lives here so the boundary rules can say so: production code
 * never imports the fake, and the dynamic import in ../bridge.ts is what keeps it out of a
 * shipped bundle.
 */
/** How often the dev loop drives the fake's clock. Real milliseconds, not the fake's. */
const TICK_MS = 50

/**
 * A folder of real photographs to serve instead of generated swatches.
 *
 * Unset is the ordinary case and the swatch is what comes back. Pointed at a folder of
 * `unsplash-NN.jpg`, a picture whose filename carries one of those numbers is served from it -
 * which is how the showcase fixture's BlurHashes describe the photograph that actually arrives,
 * since both sides are keyed on the same number.
 *
 * Outside the repository on purpose: several megabytes of somebody else's photographs are not
 * something to commit, and a dev fixture that needs them can be told where they are.
 */
const MEDIA_DIR = process.env['SESSION_FAKE_MEDIA_DIR']

/** The number in `unsplash-07.jpg`, or null for a filename that is not one of these. */
function photoNumber(filename: string | undefined): string | null {
  const match = /^unsplash-(\d{2})\.(?:jpg|mp4)$/.exec(filename ?? '')
  return match?.[1] ?? null
}

/**
 * The file behind an attachment, when there is a folder to take it from.
 *
 * A video is served its still. Nothing here plays one - the viewer opens the platform's player -
 * so what a video attachment needs is a frame, and a photograph is a frame.
 */
async function realPhoto(
  client: SessionClient,
  messageId: number,
  index: number,
): Promise<{ contentType: string; bytes: Buffer } | null> {
  if (MEDIA_DIR === undefined) return null
  const attachment = await findAttachment(client, messageId, index)
  const number = photoNumber(attachment?.filename)
  if (number === null) return null
  try {
    return {
      contentType: 'image/jpeg',
      bytes: await readFile(join(MEDIA_DIR, `unsplash-${number}.jpg`)),
    }
  } catch {
    // A folder missing a file is a dev setup half done, and a swatch says so more usefully than
    // a broken image would.
    return null
  }
}

async function findAttachment(
  client: SessionClient,
  messageId: number,
  index: number,
): Promise<Attachment | undefined> {
  for (const conversation of await client.getConversations()) {
    const page = await client.getMessages(conversation.id, { limit: 200 })
    const message = page.messages.find((m) => m.id === messageId)
    if (message) return message.attachments.find((a) => a.index === index)
  }
  return undefined
}

export function createFakeBridge(): BridgeTransport & MediaSource {
  // A conversation list big enough to measure, when something asks for one. The default stays the
  // two-account fixture, so nothing about the ordinary dev loop changes.
  const peers = Number(process.env['SESSION_FAKE_CONVERSATIONS'] ?? '0')
  // No identity yet, which is the only way to reach onboarding: everywhere else the app sees an
  // account and goes straight past it.
  const fresh = process.env['SESSION_FAKE_NO_ACCOUNT'] === '1'
  // Every attachment shape in one conversation, for looking at rather than asserting on.
  const showing = process.env['SESSION_FAKE_SHOWCASE'] === '1'
  const { world, clients } = fresh
    ? newcomer()
    : showing
      ? showcase()
      : peers > 0
        ? crowd({ peers, history: Number(process.env['SESSION_FAKE_HISTORY'] ?? '1') })
        : friends(['Alice', 'Bob'], { history: 4 })
  const alice = clients['Alice']
  if (!alice) throw new Error('the fixture did not produce a client')

  /**
   * How much slower than the fake's own clock this run should feel.
   *
   * The fake's clock is manual so tests can decide when a send lands; running the app there is
   * nobody to advance it, so it ticks here. `settle()` drains the whole queue, which is what
   * makes a transfer finish between two frames - fine for a test and useless for watching a bar
   * move. Set this and the tick advances the clock a slice at a time instead, so a download takes
   * long enough to see the placeholder, the bar, the ring and the footer change.
   *
   * A divisor rather than a duration: 10 means a tenth of the virtual time per tick, so the
   * states last ten times as long. Unset keeps the drain, which is what every existing run
   * expects.
   */
  const slowdown = Number(process.env['SESSION_FAKE_SLOWDOWN'] ?? '0')
  const ticking = setInterval(() => {
    if (slowdown > 1) world.advance(TICK_MS / slowdown)
    else world.settle()
  }, TICK_MS)
  ticking.unref?.()

  // A start that refuses, which is otherwise only reachable with a database somebody has already
  // broken. The failure screen is the one screen nobody sees by accident, so there has to be a way
  // to open it on purpose -- the message is libsession's own words for the failure that produced
  // it, so the screen looks the way it does in the wild rather than the way a placeholder does.
  if (process.env['SESSION_FAKE_FAILED_START'] === '1') {
    alice.getAccountInfo = () =>
      Promise.reject(new Error('getConversations: Invalid conversation id: not a hex session ID'))
  }

  return {
    ...createFakeTransport(alice),
    async fetchMedia(messageId: number, index: number) {
      // Through the same door a tap uses. Serving this scheme *is* a fetch: the real bridge
      // fills the cache and libsession announces the availability change, so a fake that handed
      // bytes back without either would leave every picture it just drew still reported as one
      // nobody has. Cheap to repeat - a cached attachment answers at once.
      await alice.downloadAttachment(messageId, index)
      const photo = await realPhoto(alice, messageId, index)
      if (photo) return photo
      return { contentType: 'image/png', bytes: swatchPng(messageId, index) }
    },

    async fetchPreview(messageId: number, index: number) {
      // Flat rather than blurred: the fake has no ThumbHash to decode, and what this exercises is
      // the route, not the decoder. The colour is the one its photo actually resolves to, so the
      // hand-off from placeholder to picture looks like the real one.
      const attachment = await findAttachment(alice, messageId, index)
      const photo = photoNumber(attachment?.filename)
      const [r, g, b] = (photo === null ? undefined : PHOTO_COLOURS[Number(photo) - 1]) ??
        hslToRgb((messageId * 37 + index * 89) % 360)
      const rgba = new Uint8Array(8 * 6 * 4)
      for (let i = 0; i < 8 * 6; i += 1) rgba.set([r, g, b, 255], i * 4)
      return { width: 8, height: 6, rgba }
    },
  }
}
