import { describe, expect, it } from 'vitest'

import { netidForTransport, parseNetworkName } from '../src/network'

/**
 * The case that matters is `devnet`, in a direction that is easy to get backwards.
 *
 * This used to be one expression per reader, and each turned anything unrecognised into mainnet.
 * So a build asked for a devnet, attached to mainnet, and - once the overlay arrived - would have
 * been stamped `devnet` while talking to real people. That is the pairing these two functions
 * exist to make impossible.
 */
describe('parseNetworkName', () => {
  it('defaults to mainnet when nothing is set', () => {
    expect(parseNetworkName(undefined)).toBe('mainnet')
    expect(parseNetworkName('')).toBe('mainnet')
  })

  it('keeps the networks that mean something', () => {
    expect(parseNetworkName('mainnet')).toBe('mainnet')
    expect(parseNetworkName('testnet')).toBe('testnet')
    expect(parseNetworkName('devnet'), 'never silently mainnet').toBe('devnet')
  })

  it('treats a typo as mainnet rather than guessing', () => {
    expect(parseNetworkName('devnett')).toBe('mainnet')
    expect(parseNetworkName('TESTNET')).toBe('mainnet')
  })
})

describe('netidForTransport', () => {
  it('hands through the two libsession can reach', () => {
    expect(netidForTransport('mainnet')).toBe('mainnet')
    expect(netidForTransport('testnet')).toBe('testnet')
  })

  it('attaches nothing for devnet rather than falling back to mainnet', () => {
    expect(netidForTransport('devnet')).toBeUndefined()
  })
})
