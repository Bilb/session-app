import { test as base } from '@playwright/test'

import { DesktopApp } from './DesktopApp'
import type { ISessionApp } from './ISessionApp'
import { MobileApp } from './MobileApp'

type Platform = ISessionApp['platform']

/** A client that runs on each of these in turn, one generated test per platform. */
export const EACH = 'each'
const PLATFORMS: readonly Platform[] = ['desktop', 'android', 'ios']

export interface SessionTestOptions {
  title: string
  /** How much it matters if this breaks. The tag it produces is what CI shards on. */
  risk: 'high' | 'medium' | 'low'
  /**
   * One client per entry; the platforms decide which tests get generated. `EACH` puts that client
   * on every platform in turn, the same one for all such clients in a test.
   */
  clients: Record<string, Platform | typeof EACH>
  /** Over the variables every launch sets: a fixture, say. */
  env?: Record<string, string> | undefined
  run: (apps: Record<string, ISessionApp>) => Promise<void>
}

/**
 * One way to declare a test, whatever it runs against.
 *
 * The clients descriptor decides both the platforms and the tags, so the two cannot drift:
 * a spec asking for two desktop windows is tagged @2-devices without anyone writing it
 * down. CI selects work by grepping those tags.
 *
 * This is also the only place that opens and closes clients. A spec that opened its own
 * would be a spec that leaks one when an assertion fails halfway.
 */
export function sessionTest({ title, risk, clients, env, run }: SessionTestOptions): void {
  // Without EACH a round changes nothing, so one is declared.
  const rounds = Object.values(clients).includes(EACH) ? PLATFORMS : PLATFORMS.slice(0, 1)
  for (const round of rounds) {
    const resolved = Object.fromEntries(
      Object.entries(clients).map(([identity, chosen]) => [
        identity,
        chosen === EACH ? round : chosen,
      ]),
    )
    declare(title, risk, resolved, env, run)
  }
}

function declare(
  title: string,
  risk: SessionTestOptions['risk'],
  clients: Record<string, Platform>,
  env: SessionTestOptions['env'],
  run: SessionTestOptions['run'],
): void {
  const platforms = [...new Set(Object.values(clients))]
  const scope = platforms.length > 1 ? 'cross-platform' : (platforms[0] ?? 'desktop')
  const count = Object.keys(clients).length
  const name = `${title} @${scope} @${risk}-risk @${String(count)}-devices`

  base(name, async () => {
    const opened: ISessionApp[] = []
    const apps: Record<string, ISessionApp> = {}

    try {
      // allSettled rather than all: one client failing to start must not leave its
      // siblings running with nobody holding a reference to close them.
      const results = await Promise.allSettled(
        Object.entries(clients).map(async ([identity, platform]) => {
          const app = await open(platform, identity, env)
          return [identity, app] as const
        }),
      )

      const failures: unknown[] = []
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const [identity, app] = result.value
          apps[identity] = app
          opened.push(app)
        } else {
          failures.push(result.reason)
        }
      }

      if (failures.length === 1) throw failures[0]
      if (failures.length > 1) throw new AggregateError(failures, 'Several clients failed to open')

      await run(apps)
    } finally {
      await Promise.allSettled(opened.map((app) => app.close()))
    }
  })
}

function open(
  platform: Platform,
  identity: string,
  env: SessionTestOptions['env'],
): Promise<ISessionApp> {
  switch (platform) {
    case 'desktop':
      return DesktopApp.launch(identity, { env })
    case 'android':
    case 'ios':
      return MobileApp.launch(platform, identity, { env })
  }
}
