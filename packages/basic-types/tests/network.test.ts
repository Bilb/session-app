import { describe, expect, it } from 'vitest'

import { netidForTransport, parseNetworkName } from '#src/network'

/**
 * `devnet` is the case worth pinning, and in both directions: the parser must keep it rather than
 * widening it to mainnet, and the transport must refuse it rather than narrowing it back. Either
 * slip alone puts a build meant for a sandbox on the real network.
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
