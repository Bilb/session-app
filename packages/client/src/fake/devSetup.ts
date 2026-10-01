import { friendsWithAttachments } from './attachments'
import { backlog } from './backlog'
import { crowd, newcomer, type FakeSetup } from './fixtures'
import { showcase } from './showcase'
import type { FakeWorld } from './world'

/**
 * Which world an app's dev fake starts in, and how fast its clock runs, from the environment.
 *
 * Shared so desktop and mobile start the same worlds from the same variables; each app reads its
 * environment its own way - desktop main from `process.env`, mobile from names Expo inlines - and
 * hands the raw strings here.
 */

export const FAKE_FIXTURES = ['friends', 'showcase', 'backlog', 'newcomer', 'crowd'] as const

export type FakeFixture = (typeof FAKE_FIXTURES)[number]

/** The raw values of the variables that choose a dev fake's world, unset as undefined. */
export interface FakeDevOptions {
  /** `EXPO_PUBLIC_SESSION_FAKE_FIXTURE`, on every platform: one of `FAKE_FIXTURES`. */
  fixture?: string | undefined
  /** Older than the fixture, and `newcomer`: `EXPO_PUBLIC_SESSION_NO_ACCOUNT=1` on every platform. */
  noAccount?: string | undefined
  /** Desktop's `SESSION_FAKE_SHOWCASE=1`, older than the fixture: `showcase`. */
  showcase?: string | undefined
  /** Desktop's `SESSION_FAKE_CONVERSATIONS`: how many peers `crowd` makes, and `crowd` when set. */
  conversations?: string | undefined
  /** Desktop's `SESSION_FAKE_HISTORY`: messages per peer in `crowd`. */
  history?: string | undefined
}

function chosenFixture(options: FakeDevOptions): FakeFixture {
  const named = options.fixture?.trim()
  if (named !== undefined && named !== '') {
    if ((FAKE_FIXTURES as readonly string[]).includes(named)) return named as FakeFixture
    // Loud rather than a fallback: a typo would otherwise open some other world and look fine.
    throw new Error(
      `EXPO_PUBLIC_SESSION_FAKE_FIXTURE=${named} is not a fixture; use one of ${FAKE_FIXTURES.join(', ')}`,
    )
  }
  if (options.noAccount === '1') return 'newcomer'
  if (options.showcase === '1') return 'showcase'
  if (Number(options.conversations ?? '0') > 0) return 'crowd'
  return 'friends'
}

/** The world the options name, and which fixture that was. */
export function pickFakeFixture(options: FakeDevOptions): FakeSetup & { fixture: FakeFixture } {
  const fixture = chosenFixture(options)
  switch (fixture) {
    case 'newcomer':
      return { fixture, ...newcomer() }
    case 'showcase':
      return { fixture, ...showcase() }
    case 'backlog':
      return { fixture, ...backlog() }
    case 'crowd':
      return {
        fixture,
        ...crowd({
          peers: Math.max(1, Number(options.conversations ?? '100')),
          history: Number(options.history ?? '1'),
        }),
      }
    case 'friends':
      return { fixture, ...friendsWithAttachments(['Alice', 'Bob'], { history: 4 }) }
  }
}

/** The timers every JavaScript host has, named here because this package is typed for none. */
const timers = globalThis as unknown as {
  setInterval(run: () => void, ms: number): { unref?: () => void }
  clearInterval(handle: unknown): void
}

/** How often the dev loop drives the fake's clock. Real milliseconds, not the fake's. */
export const FAKE_TICK_MS = 50

/**
 * Runs the fake's clock for an app, since there is no test to advance it.
 *
 * `slowdown` is `EXPO_PUBLIC_SESSION_FAKE_SLOWDOWN`. Unset, each tick drains the whole queue, so a transfer
 * finishes between two frames. Set to N, each tick advances only 1/N of the tick's time, so every
 * state lasts N times as long and a download is slow enough to watch the placeholder, the bar,
 * the ring and the footer change. Returns what stops it.
 */
export function driveFakeClock(world: FakeWorld, slowdown: string | undefined): () => void {
  const divisor = Number(slowdown ?? '0')
  const ticking = timers.setInterval(() => {
    if (divisor > 1) world.advance(FAKE_TICK_MS / divisor)
    else world.settle()
  }, FAKE_TICK_MS)
  // Node only: a dev clock must not keep a desktop main process alive by itself.
  ticking.unref?.()
  return () => {
    timers.clearInterval(ticking)
  }
}
