import { describe, expect, it } from 'vitest'

import type { PageResult } from '#catalog/diff'
import { describeChange, imagePath, renderReport } from '#catalog/report'

const size = { width: 100, height: 50 }
const results: PageResult[] = [
  {
    id: 'album-focus',
    status: 'changed',
    differingPixels: 1234,
    totalPixels: 5000,
    before: size,
    after: size,
  },
  { id: 'button-<new>', status: 'added', differingPixels: 0, totalPixels: 0 },
  { id: 'text-gone', status: 'removed', differingPixels: 0, totalPixels: 0 },
  {
    id: 'settings-row',
    status: 'unchanged',
    differingPixels: 0,
    totalPixels: 5000,
    before: size,
    after: size,
  },
]

const html = renderReport({
  base: { label: 'origin/main', sha: '0123456789abcdef', note: 'given the hidden-run change' },
  head: { label: 'working tree', sha: 'fedcba9876543210' },
  tier: 'pr',
  sensitivity: 0.5,
  results,
  warnings: ['The base capture is from the cache'],
})

describe('the report', () => {
  it('lists changed, added and removed pages before the unchanged ones', () => {
    const order = ['album-focus', 'button-&lt;new&gt;', 'text-gone', 'settings-row'].map((id) =>
      html.indexOf(id),
    )
    expect(order.every((at) => at > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('shows a changed page before, after and as a diff, with its count of differing pixels', () => {
    for (const kind of ['before', 'after', 'diff'] as const)
      expect(html).toContain(`src="${imagePath(kind, 'album-focus')}"`)
    expect(html).toContain('1,234 pixels differ (24.68%)')
    expect(html).toContain('type="range"')
  })

  it('escapes what it is given', () => {
    expect(html).not.toContain('button-<new>')
    expect(html).toContain('button-&lt;new&gt;')
  })

  it('names both sides and carries the warnings', () => {
    expect(html).toContain('0123456789')
    expect(html).toContain('given the hidden-run change')
    expect(html).toContain('The base capture is from the cache')
  })

  it('stands alone: no script or style fetched from anywhere', () => {
    expect(html).not.toMatch(/<(script|link)[^>]+(src|href)=/)
  })
})

describe('a change, described', () => {
  it('adds the size change when there was one', () => {
    expect(
      describeChange({
        id: 'a',
        status: 'changed',
        differingPixels: 10,
        totalPixels: 1000,
        before: { width: 10, height: 10 },
        after: { width: 10, height: 100 },
      }),
    ).toBe('10 pixels differ (1.00%); size 10×10 → 10×100')
  })
})
