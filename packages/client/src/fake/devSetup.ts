import { friendsWithAttachments } from './attachments'
import { backlog } from './backlog'
import { crowd, newcomer, type FakeSetup } from './fixtures'
import { showcase } from './showcase'
import type { FakeWorld } from './world'

/**
 * Which world an app's dev fake starts in, and how fast its clock runs, from the environment.
 *
 * Shared so desktop and mobile start the same worlds from the same variables.
 */

export const FAKE_FIXTURES = ['friends', 'showcase', 'backlog', 'newcomer', 'crowd'] as const

export type FakeFixture = (typeof FAKE_FIXTURES)[number]

/**
 * The variables that choose a dev fake's world, unset as undefined. One name on every platform:
 * desktop hands `process.env` over whole, mobile a record of literal reads, since Expo inlines a
 * variable only where its name is written out.
 */
export interface FakeDevEnv {
  /** One of `FAKE_FIXTURES`. Wins over the two below. */
  EXPO_PUBLIC_SESSION_FAKE_FIXTURE?: string | undefined
  /** `1` opens `newcomer`. Older than the fixture. */
  EXPO_PUBLIC_SESSION_NO_ACCOUNT?: string | undefined
  /** How many peers `crowd` makes, and `crowd` when set. */
  EXPO_PUBLIC_SESSION_FAKE_CROWD_PEERS?: string | undefined
  /** Messages per peer in `crowd`. */
  EXPO_PUBLIC_SESSION_FAKE_CROWD_HISTORY?: string | undefined
}

/**
 * Unset as undefined; anything that is not a count is loud, as a typo must not size a world
 * quietly.
 */
function positiveInt(name: keyof FakeDevEnv, raw: string | undefined): number | undefined {
  const text = raw?.trim()
  if (text === undefined || text === '') return undefined
  const value = Number(text)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name}=${text} is not a positive whole number`)
  }
  return value
}

function chosenFixture(env: FakeDevEnv, crowdPeers: number | undefined): FakeFixture {
  const named = env.EXPO_PUBLIC_SESSION_FAKE_FIXTURE?.trim()
  if (named !== undefined && named !== '') {
    if ((FAKE_FIXTURES as readonly string[]).includes(named)) return named as FakeFixture
    // Loud rather than a fallback: a typo would otherwise open some other world and look fine.
    throw new Error(
      `EXPO_PUBLIC_SESSION_FAKE_FIXTURE=${named} is not a fixture; use one of ${FAKE_FIXTURES.join(', ')}`,
    )
  }
  if (env.EXPO_PUBLIC_SESSION_NO_ACCOUNT === '1') return 'newcomer'
  if (crowdPeers !== undefined) return 'crowd'
  return 'friends'
}

/** The world the environment names, and which fixture that was. */
export function pickFakeFixture(env: FakeDevEnv): FakeSetup & { fixture: FakeFixture } {
  const peers = positiveInt(
    'EXPO_PUBLIC_SESSION_FAKE_CROWD_PEERS',
    env.EXPO_PUBLIC_SESSION_FAKE_CROWD_PEERS,
  )
  const history = positiveInt(
    'EXPO_PUBLIC_SESSION_FAKE_CROWD_HISTORY',
    env.EXPO_PUBLIC_SESSION_FAKE_CROWD_HISTORY,
  )
  const fixture = chosenFixture(env, peers)
  switch (fixture) {
    case 'newcomer':
      return { fixture, ...newcomer() }
    case 'showcase':
      return { fixture, ...showcase() }
    case 'backlog':
      return { fixture, ...backlog() }
    case 'crowd':
      return { fixture, ...crowd({ peers: peers ?? 100, history: history ?? 1 }) }
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
 * `slowdown` is `EXPO_PUBLIC_SESSION_FAKE_SLOWDOWN`. Unset, each tick drains the whole queue, so
 * a transfer finishes between two frames. Set to N, each tick advances only 1/N of the tick's
 * time, so every state lasts N times as long and a download is slow enough to watch the
 * placeholder, the bar, the ring and the footer change. Returns what stops it.
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
