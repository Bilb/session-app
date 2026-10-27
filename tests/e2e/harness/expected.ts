import { expect } from '@playwright/test'
import type { Expected, ExpectedNode } from '@session/expectations'
import type { ElementId } from '@session/test-ids'

import type { ISessionApp } from './ISessionApp'

/**
 * The desktop side of a shared expectation, for `toMatchObject` against `describe()`. Throws where
 * the expectation says the desktop has no such node, which a caller asserts as `null` instead.
 */
export function onDesktop(expected: Expected): Record<string, unknown> {
  if (expected.desktop === null) throw new Error('the desktop has no such node; expect null')
  return { ...expected.desktop }
}

/** The side of a shared expectation that `platform` draws. */
function sideFor(platform: ISessionApp['platform'], expected: Expected): ExpectedNode | null {
  return platform === 'desktop' ? expected.desktop : expected.native
}

/**
 * The `at`th element carrying `id` is what the expectation says on this app's platform, or is
 * absent from its tree where the expectation says it has none. `anyName` leaves the name out, for
 * a state whose wording moves, such as a transfer's progress.
 */
export async function expectDescribed(
  app: ISessionApp,
  id: ElementId,
  expected: Expected,
  at = 0,
  options: { anyName?: boolean | undefined } = {},
): Promise<void> {
  const side = sideFor(app.platform, expected)
  const node = await app.describe(id, at)
  const where = `${id} at ${String(at)} on ${app.platform}`
  if (side === null) {
    expect(node, `${where} is hidden on purpose`).toBeNull()
    return
  }
  const { name, ...rest } = side
  expect(node, where).toMatchObject(options.anyName === true ? rest : { name, ...rest })
}
