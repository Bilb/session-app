import { describe, expect, it } from 'vitest'

import { catalogPages, type CatalogTier } from '#src/catalog/pages'

const TIERS: readonly CatalogTier[] = ['pr', 'nightly']

describe('catalogPages', () => {
  // The route looks a page up by id within its tier, and an id names the PNG Argos compares.
  it.each(TIERS)('gives every %s page its own id', (tier) => {
    const ids = catalogPages(tier).map((page) => page.id)
    const repeated = ids.filter((id, at) => ids.indexOf(id) !== at)
    expect(repeated).toEqual([])
  })
})
