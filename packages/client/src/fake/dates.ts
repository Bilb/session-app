import { ensureDm, FIXTURE_NAMES, type FakeSetup } from './fixtures'
import { FakeSessionClient } from './FakeSessionClient'
import { type FakeAccount, FakeWorld, resetFakeIds } from './world'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** Local midnight at the start of the day `daysAgo` days before today. */
function midnight(daysAgo: number): number {
  const day = new Date()
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() - daysAgo)
  return day.getTime()
}

/**
 * Messages placed against the real date rather than the fake's own clock, so a date header shows
 * every label it has: another year, earlier this year, this week, yesterday, today. The fake's
 * clock starts in 2023, which would make every header read as another year.
 *
 * One conversation, Bob's, from oldest to newest:
 * - two messages 400 days ago, a minute apart: one header;
 * - two months ago;
 * - five and three days ago;
 * - yesterday at 23:58 and today at 00:01: three minutes apart, but a new day, so a header;
 * - this morning, a burst a minute apart, then one six minutes later: a header for that one;
 * - an hour ago, and just now.
 */
export function dateStates(): FakeSetup {
  resetFakeIds()
  const world = new FakeWorld()
  const [selfName, peerName] = FIXTURE_NAMES
  const self = world.account(selfName)
  const bob = world.account(peerName)
  ensureDm(self, bob, world)
  ensureDm(bob, self, world)

  const at = (whenMs: number, from: FakeAccount, body: string): void => {
    world.advance(Math.max(0, whenMs - world.now()))
    if (from === bob) bob.send(self.sessionId, body)
    else self.send(bob.sessionId, body)
    world.settle()
  }

  const nowMs = Date.now()
  const today = midnight(0)
  const morning = Math.min(today + 9 * HOUR_MS, nowMs - 2 * HOUR_MS)
  at(nowMs - 400 * DAY_MS, bob, 'Over a year ago')
  at(nowMs - 400 * DAY_MS + MINUTE_MS, self, 'A minute later: no header between these')
  at(nowMs - 60 * DAY_MS, bob, 'Two months ago')
  at(midnight(5) + 14 * HOUR_MS, self, 'Five days ago')
  at(midnight(3) + 20 * HOUR_MS, bob, 'Three days ago')
  at(today - 2 * MINUTE_MS, self, 'Yesterday, two minutes to midnight')
  at(today + MINUTE_MS, bob, 'A minute past midnight: a new day, so a header')
  at(morning, bob, 'This morning')
  at(morning + MINUTE_MS, self, 'A minute later')
  at(morning + 2 * MINUTE_MS, bob, 'And another')
  at(morning + 8 * MINUTE_MS, self, 'Six minutes after that: a header')
  at(nowMs - HOUR_MS, bob, 'An hour ago')
  at(nowMs - MINUTE_MS, self, 'Just now')

  return { world, clients: { [self.displayName]: new FakeSessionClient(self, world) } }
}
