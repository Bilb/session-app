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
    expect(networkStampLabel('testnet')).toBe('testnet')
    expect(networkStampLabel('devnet')).toBe('devnet')
  })

  it('says nothing on a real mainnet build', () => {
    expect(networkStampLabel('mainnet')).toBeNull()
  })

  it('says the fake, which the network rule alone would have kept quiet about', () => {
    // A fake build is on no network at all, so it is its own answer rather than a qualifier on
    // one -- and it has to be said loudest, because nothing else on screen distinguishes it.
    expect(networkStampLabel('fake')).toBe('Fake')
    expect(shouldStampNetwork('fake')).toBe(true)
  })
})
