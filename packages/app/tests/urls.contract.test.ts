import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { WEBSITE_URL } from '#src/urls'
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
 * Every quoted `https://` literal in the app's own code, with the file it is in.
 *
 * Read rather than compared by value, because the defect is a *second copy* of an address and two
 * copies of the same string are equal. Only the source says where one was written.
 */
function writtenAddresses(): { file: string; address: string }[] {
  return sourceFiles().flatMap((file) =>
    [
      ...readFileSync(join(repoRoot, file), 'utf8').matchAll(/['"`](https:\/\/[^'"`\s]+)['"`]/g),
    ].map((match) => ({ file, address: match[1] as string })),
  )
}

/** The entries screens link today. Not the whole table: upstream adding one is not a failure. */
const LINKED = ['faq', 'termsOfService', 'privacyPolicy'] as const

describe('the addresses the app links', () => {
  it('are in the generated table, so a field renamed upstream fails here rather than going quiet', () => {
    expect(LINKED.filter((name) => URLS[name] === undefined)).toEqual([])
  })

  /**
   * No address libsession already holds is written out anywhere in the app's own code.
   *
   * This is what makes the arrangement enforceable rather than aspirational: `codegen:check` keeps
   * the generated table honest about the library, and this keeps a literal from reappearing beside
   * it -- in a screen, a port, an app entry, anywhere a link could be typed in by hand. The two
   * together are the guarantee.
   *
   * It is also the reminder for the one address still written out: the moment libsession carries
   * the bare domain, `WEBSITE_URL` is a duplicate and this fails, which is the signal to delete it
   * and read it off the table like the rest.
   */
  it('are never written out where libsession already carries them - delete WEBSITE_URL if this fails', () => {
    const held = new Set<string>(Object.values(URLS))
    const duplicates = writtenAddresses().filter(({ address }) => held.has(address))

    expect(duplicates).toEqual([])
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

  /**
   * The bump this is waiting for, stated as a test so nothing has to remember it.
   *
   * `libsession-util#171` adds `url_website`. The next submodule bump past it regenerates the
   * table with the bare domain in it, and this fails -- which is the whole trigger for deleting
   * `urls.ts` and reading `URLS.website` at the one call site that wants it.
   */
  it('hold the bare domain here only until libsession does - delete WEBSITE_URL when this fails', () => {
    expect(Object.values(URLS)).not.toContain(WEBSITE_URL)
  })
})
