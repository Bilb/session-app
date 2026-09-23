import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { URLS } from '#src/urls.generated'

const repoRoot = join(import.meta.dirname, '../../..')

/**
 * Where the app's own code lives: every package's `src` and both apps.
 *
 * Generated output is left out because it is not written here -- the table itself, and the
 * localization catalogue, whose strings carry addresses in their copy and are regenerated wholesale.
 */
const SOURCE_ROOTS = [
  ...readdirSync(join(repoRoot, 'packages')).map((name) => join('packages', name, 'src')),
  'apps/desktop/src',
  'apps/mobile/src',
  'apps/mobile/app',
]

function isSource(path: string): boolean {
  return /\.(ts|tsx)$/.test(path) && !path.includes('generated') && !path.includes('node_modules')
}

function sourceFiles(): string[] {
  return SOURCE_ROOTS.flatMap((root) => {
    try {
      return readdirSync(join(repoRoot, root), { recursive: true, encoding: 'utf8' })
        .map((entry) => join(root, entry))
        .filter(isSource)
    } catch {
      return [] // a package with no src, such as a tooling-only one
    }
  })
}

/**
 * Every address written into the app's own code, with the file it is in.
 *
 * An address is a quoted `https://` followed by a host. A template that puts a scheme in front of
 * something the user typed -- `https://${trimmed}` -- builds an address rather than naming one, so
 * it does not count.
 */
function writtenAddresses(): { file: string; address: string }[] {
  return sourceFiles().flatMap((file) =>
    [
      ...readFileSync(join(repoRoot, file), 'utf8').matchAll(
        /['"`](https:\/\/[a-z0-9][^'"`\s]*)['"`]/gi,
      ),
    ].map((match) => ({ file, address: match[1] as string })),
  )
}

/** The entries screens link today. Not the whole table: upstream adding one is not a failure. */
const LINKED = ['faq', 'termsOfService', 'privacyPolicy', 'website'] as const

describe('the addresses the app links', () => {
  it('are in the generated table, so a field renamed upstream fails here rather than going quiet', () => {
    expect(LINKED.filter((name) => URLS[name] === undefined)).toEqual([])
  })

  /**
   * No address is written out in the app's own code. A new one goes into libsession first.
   *
   * Not only copies of ones the table already holds: an address typed into a screen that the table
   * does not have is a second list starting, and one source of truth is the point. `codegen:check`
   * keeps the generated table honest about the library, and this keeps the app from growing a list
   * beside it -- in a screen, a port, an app entry, anywhere a link could be typed in by hand.
   */
  it('are never written out in app code - add a new one to libsession instead', () => {
    expect(writtenAddresses()).toEqual([])
  })

  /**
   * The scan above passes vacuously if it reads nothing -- a root renamed, a filter too eager --
   * so this holds it to having read the screens, which is where a hand-typed link would go.
   */
  it('reads the screens, so the scan above is not passing over nothing', () => {
    expect(sourceFiles().some((file) => file.startsWith(join('packages', 'screens', 'src')))).toBe(
      true,
    )
  })
})
