import { test as base } from '@playwright/test'

import { DesktopApp } from './DesktopApp'
import type { ISessionApp } from './ISessionApp'

type Platform = 'desktop' | 'android' | 'ios'

export interface SessionTestOptions {
  title: string
  /** How much it matters if this breaks. The tag it produces is what CI shards on. */
  risk: 'high' | 'medium' | 'low'
  /** One client per entry; the platforms decide which tests get generated. */
  clients: Record<string, Platform>
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
export function sessionTest({ title, risk, clients, run }: SessionTestOptions): void {
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
          const app = await open(platform, identity)
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

function open(platform: Platform, identity: string): Promise<ISessionApp> {
  switch (platform) {
    case 'desktop':
      return DesktopApp.launch(identity)
    case 'android':
    case 'ios':
      // The mobile drivers arrive with the Nitro bridge; the interface they will implement
      // is already the one the specs are written against.
      return Promise.reject(new Error(`The ${platform} driver is not implemented yet`))
  }
}
