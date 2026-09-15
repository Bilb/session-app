import { describe, expect, it } from 'vitest'

import { networkStampLabel, shouldStampNetwork } from '#src/networkStamp'

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

describe('what the badge says', () => {
  it('names the network on a build that is not mainnet', () => {
    expect(networkStampLabel('testnet', false)).toBe('testnet')
  })

  it('says nothing on a real mainnet build', () => {
    expect(networkStampLabel('mainnet', false)).toBeNull()
  })

  it('says the fake instead of the network, because a fake build is on no network at all', () => {
    expect(networkStampLabel('testnet', true)).toBe('Fake')
  })

  it('says so even on mainnet, which the network rule alone would have kept quiet about', () => {
    expect(networkStampLabel('mainnet', true)).toBe('Fake')
  })
})
