import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { DesktopApp } from '../harness/DesktopApp'
import type { AuditIssue } from '../harness/ISessionApp'
import { auditVerdict, describeIssues, issueKey } from '../harness/knownIssues'

/** `pr` or `nightly`: see `catalogPages`. */
const TIER = process.env['CATALOG_TIER'] === 'nightly' ? 'nightly' : 'pr'
/** Where each page's PNG is written, for `argos upload`; nothing is written without it. */
const OUT = process.env['CATALOG_OUT']

/** Wide and tall enough that no page is clipped by the window. */
const WINDOW = { width: 3000, height: 2400 } as const

/** A message page waits for every picture in it to decode. */
const PAGE_READY_MS = 60_000

interface CatalogPageSummary {
  id: string
  story: string
  rows: string[]
}

interface CatalogGlobal {
  sessionCatalog?: { pages: (tier: string) => CatalogPageSummary[] }
  location: { hash: string }
}

/**
 * A finding on a cell, named by its story and row rather than by its page, theme and state: the
 * same defect drawn in every theme is one finding, and its name survives a page being added.
 */
function byRow(page: CatalogPageSummary, issue: AuditIssue): AuditIssue {
  const cell = `catalog-cell-${page.id}-`
  if (!issue.target.startsWith(cell)) return issue
  const rest = issue.target.slice(cell.length)
  const row = page.rows
    .filter((name) => rest.startsWith(`${name}-`))
    .sort((a, b) => b.length - a.length)[0]
  return row === undefined ? issue : { ...issue, target: `${page.story} ${row}` }
}

/**
 * Every catalog page of the tier, captured and audited: a page draws its story in each theme, and
 * the nightly tier in each accent too, so this is where colour contrast is checked.
 */
test(`captures and audits the component catalog's ${TIER} pages @catalog`, async () => {
  test.setTimeout(30 * 60_000)
  const app = await DesktopApp.launch('catalog', {
    env: {
      TZ: 'UTC',
      EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase',
      EXPO_PUBLIC_SESSION_FLAG_COMPONENT_CATALOG: '1',
    },
  })
  try {
    await app.resize(WINDOW.width, WINDOW.height)
    await app.page.emulateMedia({ reducedMotion: 'reduce' })
    await app.page.waitForFunction(
      () => (globalThis as unknown as CatalogGlobal).sessionCatalog !== undefined,
    )
    const pages = await app.page.evaluate(
      (tier) => (globalThis as unknown as CatalogGlobal).sessionCatalog?.pages(tier) ?? [],
      TIER,
    )
    if (OUT !== undefined) mkdirSync(OUT, { recursive: true })

    const found = new Map<string, AuditIssue>()
    for (const page of pages) {
      const { id } = page
      await app.page.evaluate(
        (hash) => {
          ;(globalThis as unknown as CatalogGlobal).location.hash = hash
        },
        `#/catalog/${TIER}/${encodeURIComponent(id)}`,
      )
      await expect(app.locator(ELEMENT.catalog.ready)).toHaveText(id, { timeout: PAGE_READY_MS })
      const png = await app
        .locator(ELEMENT.catalog.page)
        .screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' })
      if (OUT !== undefined) writeFileSync(join(OUT, `${id}.png`), png)
      for (const issue of await app.audit(ELEMENT.catalog.page)) {
        const named = byRow(page, issue)
        found.set(issueKey(named), named)
      }
    }

    const { unknown, fixed } = auditVerdict('catalog', found.values())
    expect(unknown, describeIssues(unknown).join('\n')).toEqual([])
    // The pr tier draws a subset of the pages, so only the nightly sweep can tell one is fixed.
    if (TIER === 'nightly') expect(fixed, 'no longer found: remove from KNOWN_ISSUES').toEqual([])
  } finally {
    await app.close()
  }
})
