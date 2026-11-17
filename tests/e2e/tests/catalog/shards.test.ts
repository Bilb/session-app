import { describe, expect, it } from 'vitest'

import {
  catalogVerdict,
  filterPages,
  MAX_SHARDS,
  parsePageFilter,
  shardCount,
  splitPages,
  type CatalogPageSummary,
} from '#catalog/shards'

import type { AuditIssue } from '../../harness/ISessionApp'
import { issueKey } from '../../harness/knownIssues'

const weighted = (cells: readonly number[]) =>
  cells.map((count, at) => ({ id: `page-${String(at)}`, cells: count }))

const sum = (pages: readonly { cells: number }[]) =>
  pages.reduce((total, page) => total + page.cells, 0)

describe('the shard count', () => {
  it('takes CATALOG_SHARDS over the cores', () => {
    expect(shardCount('3', 64)).toBe(3)
    expect(shardCount('1', 64)).toBe(1)
  })

  it('refuses a count that is not a whole number of shards', () => {
    for (const bad of ['0', '-2', '1.5', 'four']) expect(() => shardCount(bad, 8)).toThrow()
  })

  it('grows with the cores, from one to the most that pays', () => {
    expect(shardCount(undefined, 1)).toBe(1)
    expect(shardCount('', 2)).toBe(1)
    expect(shardCount(undefined, 12)).toBeGreaterThan(shardCount(undefined, 4))
    expect(shardCount(undefined, 256)).toBe(MAX_SHARDS)
  })
})

describe('the split', () => {
  const pages = weighted([4, 96, 12, 12, 40, 8, 8, 30, 2, 64, 16, 24, 6, 48, 20])

  it('puts every page in exactly one shard', () => {
    for (const count of [1, 2, 3, 4, 6, 15, 40]) {
      const ids = splitPages(pages, count).flatMap((shard) => shard.map((page) => page.id))
      expect([...ids].sort()).toEqual(pages.map((page) => page.id).sort())
    }
  })

  it('keeps the tier order within a shard', () => {
    for (const shard of splitPages(pages, 4)) {
      const at = shard.map((page) => pages.indexOf(page))
      expect(at).toEqual([...at].sort((a, b) => a - b))
    }
  })

  it('splits the same pages the same way every time', () => {
    expect(splitPages([...pages], 4)).toEqual(splitPages(pages, 4))
    // Equal weights fall to the earlier page and the lower shard.
    expect(
      splitPages(weighted([5, 5, 5, 5]), 2).map((shard) => shard.map((page) => page.id)),
    ).toEqual([
      ['page-0', 'page-2'],
      ['page-1', 'page-3'],
    ])
  })

  it('balances cells rather than pages', () => {
    const shards = splitPages(weighted([90, 10, 10, 10, 10, 10, 10, 10, 10, 10]), 2)
    expect(shards.map(sum)).toEqual([90, 90])
    expect(shards.map((shard) => shard.length)).toEqual([1, 9])

    const loads = splitPages(pages, 4).map(sum)
    // Greedy heaviest-first is within the heaviest page of the ideal.
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(96)
    expect(Math.max(...loads)).toBeLessThanOrEqual(Math.ceil(sum(pages) / 4) + 96)
  })

  it('makes no empty shard', () => {
    expect(splitPages(weighted([3, 1]), 6)).toHaveLength(2)
    expect(splitPages([], 4)).toEqual([])
  })
})

describe('the page filter', () => {
  const tier: CatalogPageSummary[] = [
    { id: 'messageQuote-text', story: 'messageQuote.text', rows: [], cells: 4 },
    { id: 'messageQuote-text-rtl', story: 'messageQuote.text', rows: [], cells: 1 },
    { id: 'messageQuote-media', story: 'messageQuote.media', rows: [], cells: 4 },
    { id: 'messageFrame-bubble', story: 'messageFrame.bubble', rows: [], cells: 4 },
    { id: 'button-variants', story: 'button.variants', rows: [], cells: 4 },
  ]
  const ids = (pages: readonly CatalogPageSummary[]) => pages.map((page) => page.id)

  it('reads a comma-separated list, and nothing as no filter', () => {
    expect(parsePageFilter(' messageQuote,button.variants ,')).toEqual([
      'messageQuote',
      'button.variants',
    ])
    expect(parsePageFilter(undefined)).toBeUndefined()
    expect(parsePageFilter(' , ')).toBeUndefined()
  })

  it('takes a component, a component.story or a page id, in tier order', () => {
    expect(ids(filterPages(tier, ['button', 'messageQuote']))).toEqual([
      'messageQuote-text',
      'messageQuote-text-rtl',
      'messageQuote-media',
      'button-variants',
    ])
    expect(ids(filterPages(tier, ['messageQuote.text']))).toEqual([
      'messageQuote-text',
      'messageQuote-text-rtl',
    ])
    expect(ids(filterPages(tier, ['messageQuote-text-rtl']))).toEqual(['messageQuote-text-rtl'])
    expect(filterPages(tier, undefined)).toEqual(tier)
  })

  it('does not take a component for a prefix of another', () => {
    expect(() => filterPages(tier, ['message'])).toThrow(/message/)
  })

  it('names what matched no page', () => {
    expect(() => filterPages(tier, ['button', 'mesageQuote'])).toThrow(/mesageQuote/)
  })
})

describe('the verdict over every shard', () => {
  // With nothing found, every known issue reads as fixed: that is the list of them.
  const known = catalogVerdict([], true).fixed ?? []
  const issueFor = (key: string): AuditIssue => {
    const [rule = '', ...target] = key.split(' ')
    return { rule, target: target.join(' '), impact: 'serious', message: key }
  }
  const allKnown = known.map(issueFor)
  const unknownIssue: AuditIssue = {
    rule: 'color-contrast',
    target: 'nothing.known here',
    impact: 'serious',
    message: 'not in KNOWN_ISSUES',
  }

  it('starts from a non-empty list of known issues', () => {
    expect(known.length).toBeGreaterThan(1)
  })

  it('never calls a known issue fixed when another shard found it', () => {
    const [mine, ...theirs] = allKnown
    const verdict = catalogVerdict(
      [
        { at: 0, issues: mine === undefined ? [] : [mine] },
        { at: 1, issues: theirs },
      ],
      true,
    )
    expect(verdict.fixed).toEqual([])
    expect(verdict.unknown).toEqual([])
  })

  it('calls fixed what no shard found, on a whole nightly sweep only', () => {
    const [gone, ...rest] = allKnown
    const outcomes = [{ at: 0, issues: rest }]
    expect(catalogVerdict(outcomes, true).fixed).toEqual(gone === undefined ? [] : [issueKey(gone)])
    expect(catalogVerdict(outcomes, false).fixed).toBeNull()
    expect(
      catalogVerdict([...outcomes, { at: 1, tooTall: 'tall: too tall' }], true).fixed,
    ).toBeNull()
  })

  it('reads the same whichever shard a page was on, in tier order', () => {
    const second = { ...unknownIssue, target: 'nothing.known there' }
    const sequential = catalogVerdict(
      [
        { at: 0, issues: [unknownIssue] },
        { at: 1, tooTall: 'b: too tall' },
        { at: 2, issues: [second, unknownIssue] },
        { at: 3, tooTall: 'd: too tall' },
      ],
      true,
    )
    const sharded = catalogVerdict(
      [
        { at: 3, tooTall: 'd: too tall' },
        { at: 2, issues: [second, unknownIssue] },
        { at: 1, tooTall: 'b: too tall' },
        { at: 0, issues: [unknownIssue] },
      ],
      true,
    )
    expect(sharded).toEqual(sequential)
    expect(sharded.unknown).toEqual([unknownIssue, second])
    expect(sharded.tooTall).toEqual(['b: too tall', 'd: too tall'])
  })
})
