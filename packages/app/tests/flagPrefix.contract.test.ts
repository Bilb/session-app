import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { FLAGS, envVarFor, type FlagName } from '#src/flags'

/**
 * Every place that spells a flag's variable name agrees on the spelling.
 *
 * Three of them exist and none can see the others: the shared table derives the name, the mobile
 * bundle lists each one literally because Expo only substitutes literals, and the desktop config
 * collects them by prefix. **The prefix changed once and only two of the three moved.** Nothing
 * failed -- no flag matched the desktop filter, so every override there read as its default with
 * nothing said, which is the same silence a missing token gives.
 *
 * Read out of the files rather than imported, because that is the point: two of the three are
 * build configuration this package cannot reach, and a test that imported them would be testing
 * something else.
 */
describe('a flag variable name', () => {
  const root = join(import.meta.dirname, '../../..')
  const names = (Object.keys(FLAGS) as FlagName[]).map(envVarFor)

  it('is spelled the same by the table, the mobile map and the desktop collection', () => {
    const mobile = readFileSync(join(root, 'apps/mobile/src/flagOverrides.ts'), 'utf8')
    const missing = names.filter((name) => !mobile.includes(name))
    expect(missing, 'flags the mobile bundle would never substitute').toEqual([])

    const desktop = readFileSync(join(root, 'apps/desktop/electron.vite.config.ts'), 'utf8')
    const prefix = /const FLAG_PREFIX = '([^']+)'/.exec(desktop)?.[1]
    expect(prefix, 'the desktop config names the prefix in one place').toBeDefined()
    const dropped = names.filter((name) => prefix === undefined || !name.startsWith(prefix))
    expect(dropped, 'flags the desktop collection would drop').toEqual([])
  })
})
