import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Every screen a person can navigate *to* has a way back out.
 *
 * A screen reached by a push and drawn without one is a dead end on mobile, where there is no
 * browser chrome and, on iOS, no system back either. It is invisible on desktop, which has a
 * window and a keyboard, so it is exactly the kind of thing that ships: `RequestsScreen` was
 * pushed from the conversation list for weeks with no way off it.
 *
 * Listed rather than inferred, because "is this screen a root" is not something the file says.
 * A new screen therefore fails this until somebody decides which it is, which is the point.
 */
const ROOTS = new Set([
  // The home screen: there is nothing behind it.
  'ConversationListScreen.tsx',
  // Nothing exists yet to go back to, and leaving is not a thing to offer.
  'OnboardingScreen.tsx',
  // Shown while the store wakes up; it navigates away by itself.
  'StartingScreen.tsx',
])

const dir = join(import.meta.dirname, '../src')
const screens = readdirSync(dir).filter((name) => name.endsWith('Screen.tsx'))

describe('a screen that was pushed can be left', () => {
  it('finds the screens to check', () => {
    // Guards the guard: a rename that emptied this list would otherwise pass in silence.
    expect(screens.length).toBeGreaterThan(3)
    for (const root of ROOTS) expect(screens).toContain(root)
  })

  it.each(screens.filter((name) => !ROOTS.has(name)))('%s renders a BackButton', (name) => {
    expect(readFileSync(join(dir, name), 'utf8')).toContain('<BackButton')
  })
})
