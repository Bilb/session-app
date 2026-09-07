import { describe, expect, it } from 'vitest'

import { shouldStampNetwork } from './networkStamp'

/**
 * Both directions matter, for opposite reasons. Stamping mainnet would put a badge across every
 * real build. Not stamping devnet is the one that costs somebody an afternoon, because a devnet
 * build that looks like a real one is one people treat as real - which is the entire reason iOS
 * draws this over its nav bar logo.
 */
describe('shouldStampNetwork', () => {
  it('leaves a real build alone', () => {
    expect(shouldStampNetwork('mainnet')).toBe(false)
  })

  it('says so on anything else', () => {
    expect(shouldStampNetwork('testnet')).toBe(true)
    expect(shouldStampNetwork('devnet')).toBe(true)
  })
})
