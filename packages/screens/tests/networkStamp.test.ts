import { describe, expect, it } from 'vitest'

import { shouldStampNetwork } from '#src/networkStamp'

/**
 * Both directions are asserted because the failures are opposite and both are silent: a badge over
 * every real build, or a sandbox build that looks exactly like a real one.
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
