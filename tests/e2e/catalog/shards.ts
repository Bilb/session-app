import type { AuditIssue } from '../harness/ISessionApp'
import { auditVerdict, issueKey } from '../harness/knownIssues'

/** What the spec needs to know of a catalog page to place it and name its findings. */
export interface CatalogPageSummary {
  id: string
  /** `component.story`. */
  story: string
  rows: string[]
  /** `cellsOn`: the component renders it holds, which is what its capture and audit cost. */
  cells: number
}

/**
 * How many cores one shard keeps busy: its renderer runs axe and paints, and Electron's main and
 * the Playwright driver take the rest. Two catalog runners share the CI host, so a shard per
 * core would overcommit it when both capture at once.
 */
export const CORES_PER_SHARD = 3
/** The most measured; each shard also holds an X server and a window up to 3600x8000. */
export const MAX_SHARDS = 8

/** `CATALOG_SHARDS` when set, else a shard per `CORES_PER_SHARD` cores, at most `MAX_SHARDS`. */
export function shardCount(override: string | undefined, cores: number): number {
  if (override !== undefined && override !== '') {
    const count = Number(override)
    if (!Number.isInteger(count) || count < 1)
      throw new Error(`CATALOG_SHARDS takes a whole number of shards, 1 or more, not ${override}`)
    return count
  }
  return Math.max(1, Math.min(MAX_SHARDS, Math.floor(cores / CORES_PER_SHARD)))
}

/**
 * Deals the pages into at most `count` shards of near-equal cells: heaviest page first, each to
 * the lightest shard so far, ties to the earlier page and the lower shard, so the same pages always
 * split the same way. Each shard keeps the tier's order, and none is empty.
 */
export function splitPages<Page extends { cells: number }>(
  pages: readonly Page[],
  count: number,
): Page[][] {
  const shards = Array.from({ length: Math.min(count, pages.length) }, () => ({
    cells: 0,
    at: [] as number[],
  }))
  if (shards.length === 0) return []
  const heaviestFirst = pages
    .map((page, at) => ({ cells: page.cells, at }))
    .sort((a, b) => b.cells - a.cells || a.at - b.at)
  for (const { cells, at } of heaviestFirst) {
    const lightest = shards.reduce((best, shard) => (shard.cells < best.cells ? shard : best))
    lightest.cells += cells
    lightest.at.push(at)
  }
  return shards.map((shard) => shard.at.sort((a, b) => a - b).map((at) => pages[at] as Page))
}

/** `CATALOG_PAGES`: comma-separated, each a page id, a `component.story` or a component. */
export function parsePageFilter(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined
  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
  return names.length === 0 ? undefined : names
}

const matches = (page: CatalogPageSummary, name: string) =>
  page.id === name || page.story === name || page.story.split('.')[0] === name

/** The tier's pages the filter names, in tier order; a name that matches none is an error. */
export function filterPages(
  pages: readonly CatalogPageSummary[],
  filter: readonly string[] | undefined,
): CatalogPageSummary[] {
  if (filter === undefined) return [...pages]
  const unmatched = filter.filter((name) => !pages.some((page) => matches(page, name)))
  if (unmatched.length > 0)
    throw new Error(
      `CATALOG_PAGES names no page of this tier: ${unmatched.join(', ')}; ` +
        'give a page id, a component.story or a component',
    )
  return pages.filter((page) => filter.some((name) => matches(page, name)))
}

/** What drawing one page came to: its findings, or why it could not be captured. */
export type PageOutcome =
  { at: number; issues: readonly AuditIssue[] } | { at: number; tooTall: string }

/**
 * One verdict over every shard's pages, merged in tier order, so it reads as a single sweep's.
 * `sweep` is whether the run drew the whole nightly tier: only then can a known issue that no
 * shard found be called fixed, and `fixed` is null otherwise.
 */
export function catalogVerdict(outcomes: Iterable<PageOutcome>, sweep: boolean) {
  const found = new Map<string, AuditIssue>()
  const tooTall: string[] = []
  for (const outcome of [...outcomes].sort((a, b) => a.at - b.at)) {
    if ('tooTall' in outcome) tooTall.push(outcome.tooTall)
    else for (const issue of outcome.issues) found.set(issueKey(issue), issue)
  }
  const { unknown, fixed } = auditVerdict('catalog', found.values())
  return { unknown, tooTall, fixed: sweep && tooTall.length === 0 ? fixed : null }
}
