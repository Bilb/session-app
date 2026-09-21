import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { WEBSITE_URL } from '#src/urls'
import { URLS } from '#src/urls.generated'

/**
 * Read rather than compared by value, because the defect is a *second copy* of an address and two
 * copies of the same string are equal. Only the source says which one was written here.
 */
const source = readFileSync(join(import.meta.dirname, '../src/urls.ts'), 'utf8')

/** The entries screens link today. Not the whole table: upstream adding one is not a failure. */
const LINKED = ['faq', 'termsOfService', 'privacyPolicy'] as const

describe('the addresses the app links', () => {
  it('are in the generated table, so a field renamed upstream fails here rather than going quiet', () => {
    expect(LINKED.filter((name) => URLS[name] === undefined)).toEqual([])
  })

  /**
   * An address libsession already holds must be read from it.
   *
   * This is what makes the arrangement enforceable rather than aspirational: `codegen:check` keeps
   * the generated table honest about the library, and this keeps a literal from reappearing beside
   * it. The two together are the guarantee.
   *
   * It is also the reminder for the one address still written out: the moment libsession carries
   * the bare domain, `WEBSITE_URL` is a duplicate and this fails, which is the signal to delete it
   * and read it off the table like the rest.
   */
  it('are not written out again where libsession already carries them - delete WEBSITE_URL if this fails', () => {
    const held = new Set<string>(Object.values(URLS))
    const written = [...source.matchAll(/'(https:\/\/[^']+)'/g)].map((match) => match[1] as string)

    expect(written.filter((address) => held.has(address))).toEqual([])
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
