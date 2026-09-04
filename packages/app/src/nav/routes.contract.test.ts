/**
 * Holds the three declarations of a route together.
 *
 *   routes.ts                     /c/:id           the source of truth
 *   apps/desktop  App.tsx         path="c/:id"     a react-router table
 *   apps/mobile   app/c/[id].tsx  a file on disk   expo-router's routes ARE the filesystem,
 *                                                  so nothing can generate them
 *
 * Three spellings of the same fact, in three languages, none of which can check the others.
 * This test is the thing that notices when one of them moves. It deliberately has no router
 * dependency of its own: it reads the desktop table as text and asks the filesystem about
 * the mobile one.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { conversationFromPath, routes } from './routes'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')

interface RouteContract {
  /** What routes.ts builds. */
  path: string
  /** The pattern the desktop router declares. */
  desktop: string
  /** The file expo-router turns into a route. */
  mobile: string
}

const ROUTES: RouteContract[] = [
  { path: routes.home(), desktop: '', mobile: 'index.tsx' },
  { path: routes.conversation('05abc'), desktop: 'c/:id', mobile: 'c/[id].tsx' },
  { path: routes.requests(), desktop: 'requests', mobile: 'requests.tsx' },
  { path: routes.settings(), desktop: 'settings', mobile: 'settings.tsx' },
  { path: routes.onboarding(), desktop: 'onboarding', mobile: 'onboarding.tsx' },
]

function declaredDesktopPaths(): string[] {
  const source = readFileSync(join(repoRoot, 'apps/desktop/src/renderer/App.tsx'), 'utf8')
  return [...source.matchAll(/path="([^"]*)"/g)].map((match) => match[1] ?? '')
}

/** Segment count plus literal comparison; a `:param` matches any one non-empty segment. */
function patternMatches(pattern: string, path: string): boolean {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return false
  return patternParts.every((part, index) => {
    const actual = pathParts[index]
    if (actual === undefined || actual.length === 0) return false
    return part.startsWith(':') ? true : part === actual
  })
}

describe('route contract', () => {
  it.each(ROUTES)('$path is declared by the desktop router', ({ path, desktop }) => {
    const declared = declaredDesktopPaths()
    expect(declared).toContain(desktop)
    expect(patternMatches(desktop, path)).toBe(true)
  })

  it.each(ROUTES)('$path has a route file in the mobile app', ({ mobile }) => {
    expect(existsSync(join(repoRoot, 'apps/mobile/app', mobile))).toBe(true)
  })

  it('builds every path as an absolute one', () => {
    // A path that did not start with "/" would concatenate into nonsense the first time a
    // driver applied a prefix to it.
    for (const { path } of ROUTES) expect(path.startsWith('/')).toBe(true)
  })

  it('reads a conversation id back out of the path it built', () => {
    // Community ids carry slashes, so the round trip has to survive encoding.
    for (const id of ['05abc', 'community:https://open.getsession.org/room']) {
      expect(conversationFromPath(routes.conversation(id))).toBe(id)
    }
  })

  it('finds no conversation in a path that is not one', () => {
    expect(conversationFromPath('/')).toBe(null)
    expect(conversationFromPath('/settings')).toBe(null)
  })

  it('guards the guard', () => {
    // If patternMatches accepted anything, every assertion above would pass vacuously.
    expect(patternMatches('c/:id', '/c/05abc')).toBe(true)
    expect(patternMatches('c/:id', '/c/05abc/extra')).toBe(false)
    expect(patternMatches('c/:id', '/settings')).toBe(false)
    expect(patternMatches('requests', '/settings')).toBe(false)
  })
})
