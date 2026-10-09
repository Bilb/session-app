import { describe, expect, it } from 'vitest'

import { networkRows } from '#src/network'

const NONE = {
  fake: false,
  netid: undefined,
  router: undefined,
  devnetSeedUrl: undefined,
  fileServerUrl: undefined,
  logSpec: undefined,
}

describe('networkRows', () => {
  it("says which transport and whether it was chosen or libsession's default", () => {
    expect(networkRows(NONE)).toMatchObject({
      network: 'mainnet',
      transport: 'Session Router (default)',
    })
    expect(networkRows({ ...NONE, netid: 'devnet' }).transport).toBe('onion requests (default)')
    expect(networkRows({ ...NONE, router: 'onion-requests' }).transport).toBe(
      'onion requests (set)',
    )
  })

  it('lists the further settings that were given, and the log spec', () => {
    const rows = networkRows({
      ...NONE,
      netid: 'devnet',
      devnetSeedUrl: 'http://10.0.0.5:22023',
      logSpec: 'info,network=debug',
    })
    expect(rows.networkSettings).toEqual([['Seed node', 'http://10.0.0.5:22023']])
    expect(rows.logSpec).toBe('info,network=debug')
    expect(networkRows(NONE).logSpec).toBe("libsession's default")
  })

  it('names the fake for what it is, with no transport', () => {
    expect(networkRows({ ...NONE, fake: true })).toMatchObject({
      network: 'fake (no libsession)',
      transport: null,
    })
  })
})
