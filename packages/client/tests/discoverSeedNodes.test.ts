import { describe, expect, it, vi } from 'vitest'

import { discoverSeedNodes, seedNodesFrom, type FetchLike } from '#src/discoverSeedNodes'

/**
 * The payload below is what a running devnet actually answered, trimmed to three nodes. Every
 * field name here is oxend's rather than ours, so a fixture invented from the mapping would agree
 * with the mapping and prove nothing.
 */
const REAL_REPLY = {
  id: '0',
  jsonrpc: '2.0',
  result: {
    service_node_states: [
      {
        pubkey_ed25519: 'adda0897b0b7466d22b42b2a666de064a3d17f41f99f8e65b3e4916274d0fb1c',
        public_ip: '192.168.1.114',
        storage_lmq_port: 1335,
        storage_port: 1330,
        storage_server_reachable: true,
      },
      {
        pubkey_ed25519: '0088b6739cb0a572ea653cef8cb9aa61b6b32750b31d28accae8721d8ffb9b5c',
        public_ip: '192.168.1.114',
        storage_lmq_port: 1305,
        storage_port: 1300,
        storage_server_reachable: true,
      },
      {
        pubkey_ed25519: 'a6001ca1849befa21512d33a3103afdac40fb10eae3aa29b57c3521ec5b4bc57',
        public_ip: '192.168.1.114',
        storage_lmq_port: 1455,
        storage_port: 1450,
        storage_server_reachable: true,
      },
    ],
    status: 'OK',
  },
}

const answering = (payload: unknown, ok = true, status = 200): FetchLike =>
  vi.fn(() => Promise.resolve({ ok, status, json: () => Promise.resolve(payload) }))

describe('seedNodesFrom', () => {
  it('maps oxend field names onto what libsession takes', () => {
    expect(seedNodesFrom(REAL_REPLY)).toEqual([
      {
        ed25519PubkeyHex: 'adda0897b0b7466d22b42b2a666de064a3d17f41f99f8e65b3e4916274d0fb1c',
        ip: '192.168.1.114',
        httpsPort: 1330,
        omqPort: 1335,
      },
      {
        ed25519PubkeyHex: '0088b6739cb0a572ea653cef8cb9aa61b6b32750b31d28accae8721d8ffb9b5c',
        ip: '192.168.1.114',
        httpsPort: 1300,
        omqPort: 1305,
      },
      {
        ed25519PubkeyHex: 'a6001ca1849befa21512d33a3103afdac40fb10eae3aa29b57c3521ec5b4bc57',
        ip: '192.168.1.114',
        httpsPort: 1450,
        omqPort: 1455,
      },
    ])
  })

  it('drops a node that cannot serve, rather than handing libsession a dead seed', () => {
    const one = REAL_REPLY.result.service_node_states[0]
    const payload = {
      result: {
        service_node_states: [
          { ...one, storage_server_reachable: false },
          { ...one, pubkey_ed25519: 'nothex' },
          { ...one, public_ip: '10.0.0.999' },
          // A container-internal hostname is what a misconfigured compose advertises, and
          // libsession would never resolve it.
          { ...one, public_ip: 'storage-1' },
          { ...one, storage_port: 0 },
          { ...one, storage_lmq_port: 70000 },
        ],
      },
    }
    expect(seedNodesFrom(payload)).toEqual([])
  })

  it('reads a reply that is not one as no nodes at all', () => {
    for (const payload of [
      undefined,
      null,
      {},
      { result: {} },
      { result: { service_node_states: 3 } },
    ])
      expect(seedNodesFrom(payload)).toEqual([])
  })
})

describe('discoverSeedNodes', () => {
  it('asks the RPC endpoint for exactly the fields a seed node is built from', async () => {
    const fetch = answering(REAL_REPLY)
    await discoverSeedNodes('http://192.168.1.114:1280', { fetch })

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(url).toBe('http://192.168.1.114:1280/json_rpc')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body ?? '{}')).toMatchObject({
      method: 'get_n_service_nodes',
      params: {
        active_only: true,
        fields: {
          pubkey_ed25519: true,
          public_ip: true,
          storage_port: true,
          storage_lmq_port: true,
          storage_server_reachable: true,
        },
      },
    })
  })

  it('does not double the slash when the URL has a trailing one', async () => {
    const fetch = answering(REAL_REPLY)
    await discoverSeedNodes('http://10.0.0.1:1280/', { fetch })
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('http://10.0.0.1:1280/json_rpc')
  })

  it('names the variable when the RPC cannot be reached', async () => {
    const fetch: FetchLike = () => Promise.reject(new Error('fetch failed'))
    await expect(
      discoverSeedNodes('http://10.0.0.1:1280', { fetch, variable: 'SESSION_DEVNET_SEED_URL' }),
    ).rejects.toThrow(/SESSION_DEVNET_SEED_URL/)
  })

  it('reports a status that is not a node list', async () => {
    await expect(
      discoverSeedNodes('http://10.0.0.1:1280', { fetch: answering({}, false, 404) }),
    ).rejects.toThrow(/404/)
  })

  it('says so when something answered but not an oxend RPC', async () => {
    await expect(
      discoverSeedNodes('http://10.0.0.1:1280', { fetch: answering({ hello: true }) }),
    ).rejects.toThrow(/not like an oxend RPC/)
  })

  it('refuses a devnet with no usable node rather than returning an empty list', async () => {
    const payload = { result: { service_node_states: [] } }
    await expect(
      discoverSeedNodes('http://10.0.0.1:1280', { fetch: answering(payload) }),
    ).rejects.toThrow(/no usable service node/)
  })
})
