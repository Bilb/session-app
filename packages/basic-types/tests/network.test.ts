import { describe, expect, it } from 'vitest'

import {
  netidForTransport,
  parseDevnetConfig,
  parseNetworkName,
  type DevnetEnv,
} from '#src/network'

/**
 * `devnet` is the case worth pinning, and in both directions: the parser must keep it rather than
 * widening it to mainnet, and the transport must refuse an unconfigured one rather than narrowing
 * it back. Either slip alone puts a build meant for a sandbox on the real network.
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
  const configured = { seedUrl: 'http://10.0.0.1:1280' }

  it('hands through the networks libsession has seeds for', () => {
    expect(netidForTransport('mainnet', undefined)).toBe('mainnet')
    expect(netidForTransport('testnet', undefined)).toBe('testnet')
  })

  it('attaches a configured devnet', () => {
    expect(netidForTransport('devnet', configured)).toBe('devnet')
  })

  it('attaches nothing for an unconfigured devnet rather than falling back to mainnet', () => {
    expect(netidForTransport('devnet', undefined)).toBeUndefined()
  })
})

const KEY_A = 'a'.repeat(64)
const KEY_B = 'b'.repeat(64)

const nothing: DevnetEnv = {
  seedUrl: undefined,
  fileServerUrl: undefined,
  fileServerX25519Pubkey: undefined,
  proBackendUrl: undefined,
  proBackendEd25519Pubkey: undefined,
}

const env = (over: Partial<DevnetEnv>): DevnetEnv => ({ ...nothing, ...over })

describe('parseDevnetConfig', () => {
  it('names the variable when the seed node is missing', () => {
    expect(() => parseDevnetConfig(nothing, 'SESSION_')).toThrow(/SESSION_DEVNET_SEED_URL/)
    expect(() => parseDevnetConfig(env({ seedUrl: '   ' }), 'SESSION_')).toThrow(
      /SESSION_DEVNET_SEED_URL/,
    )
  })

  it('names the variable under whatever prefix the app reads', () => {
    expect(() => parseDevnetConfig(nothing, 'EXPO_PUBLIC_SESSION_')).toThrow(
      /EXPO_PUBLIC_SESSION_DEVNET_SEED_URL/,
    )
  })

  it('accepts every way a seed node gets copied out of a node table', () => {
    for (const value of [
      '192.168.1.114',
      '192.168.1.114:1280',
      'http://192.168.1.114:1280',
      'http://192.168.1.114:1280/',
      '  192.168.1.114:1280  ',
    ])
      expect(parseDevnetConfig(env({ seedUrl: value }), 'SESSION_').seedUrl).toBe(
        'http://192.168.1.114:1280',
      )
  })

  it('keeps a port that is not the default', () => {
    expect(parseDevnetConfig(env({ seedUrl: '10.0.0.1:2280' }), 'SESSION_').seedUrl).toBe(
      'http://10.0.0.1:2280',
    )
  })

  it('refuses a seed node that is not an http address', () => {
    expect(() => parseDevnetConfig(env({ seedUrl: 'ftp://10.0.0.1:1280' }), 'SESSION_')).toThrow(
      /must be http/,
    )
  })

  it('takes a file server as a pair, because half of one is worse than none', () => {
    expect(() =>
      parseDevnetConfig(
        env({ seedUrl: '10.0.0.1', fileServerUrl: 'http://10.0.0.1:8000' }),
        'SESSION_',
      ),
    ).toThrow(/FILE_SERVER_X25519_PUBKEY/)
    expect(() =>
      parseDevnetConfig(env({ seedUrl: '10.0.0.1', fileServerX25519Pubkey: KEY_A }), 'SESSION_'),
    ).toThrow(/FILE_SERVER_URL/)
  })

  it('splits a file server URL into what libsession takes', () => {
    const { fileServer } = parseDevnetConfig(
      env({
        seedUrl: '10.0.0.1',
        fileServerUrl: 'http://10.0.0.1:8000',
        fileServerX25519Pubkey: KEY_A.toUpperCase(),
      }),
      'SESSION_',
    )
    expect(fileServer).toEqual({
      scheme: 'http',
      host: '10.0.0.1',
      port: 8000,
      x25519PubkeyHex: KEY_A,
    })
  })

  it('makes a file server name its port, since a devnet does not serve on 80', () => {
    expect(() =>
      parseDevnetConfig(
        env({
          seedUrl: '10.0.0.1',
          fileServerUrl: 'http://10.0.0.1',
          fileServerX25519Pubkey: KEY_A,
        }),
        'SESSION_',
      ),
    ).toThrow(/must name a port/)
  })

  it('refuses a key that is not 64 hex characters, naming it', () => {
    for (const bad of ['a'.repeat(63), 'a'.repeat(65), `${'a'.repeat(63)}g`])
      expect(() =>
        parseDevnetConfig(
          env({
            seedUrl: '10.0.0.1',
            fileServerUrl: 'http://10.0.0.1:8000',
            fileServerX25519Pubkey: bad,
          }),
          'SESSION_',
        ),
      ).toThrow(/SESSION_FILE_SERVER_X25519_PUBKEY must be 64 hex characters/)
  })

  it('carries a pro backend that nothing reads yet', () => {
    const { proBackend } = parseDevnetConfig(
      env({
        seedUrl: '10.0.0.1',
        proBackendUrl: 'http://10.0.0.1:8090',
        proBackendEd25519Pubkey: KEY_B,
      }),
      'SESSION_',
    )
    expect(proBackend).toEqual({ url: 'http://10.0.0.1:8090', ed25519PubkeyHex: KEY_B })
  })

  it('leaves both services out when neither is configured', () => {
    const config = parseDevnetConfig(env({ seedUrl: '10.0.0.1' }), 'SESSION_')
    expect(config.fileServer).toBeUndefined()
    expect(config.proBackend).toBeUndefined()
  })
})
