import type { SeedNode } from '@session/bridge-types'

/**
 * Asks a devnet's seed node which storage servers it knows, so a build can be configured with one
 * address instead of four values per node.
 *
 * libsession needs a pubkey, an IPv4 address and two ports for every seed it bootstraps from, and
 * a devnet regenerates those keys whenever it is rebuilt - so anything written down by hand goes
 * stale silently. oxend will say, which makes the RPC address the only thing worth configuring.
 */

/**
 * The slice of `fetch` this needs, written out because the shared packages typecheck with no DOM
 * and no node types. Each app passes its own, which is also where a timeout belongs.
 */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

/** What oxend is asked for. Exactly the fields a `SeedNode` is built from, and no others. */
const REQUEST = {
  jsonrpc: '2.0',
  id: '0',
  method: 'get_n_service_nodes',
  params: {
    active_only: true,
    limit: 50,
    fields: {
      public_ip: true,
      storage_port: true,
      storage_lmq_port: true,
      pubkey_ed25519: true,
      storage_server_reachable: true,
    },
  },
} as const

interface ServiceNodeState {
  pubkey_ed25519?: unknown
  public_ip?: unknown
  storage_port?: unknown
  storage_lmq_port?: unknown
  storage_server_reachable?: unknown
}

const HEX64 = /^[0-9a-f]{64}$/i
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function port(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65535
}

function ipv4(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = IPV4.exec(value)
  return match !== null && match.slice(1).every((octet) => Number(octet) <= 255)
}

function states(payload: unknown): ServiceNodeState[] | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const result = (payload as { result?: unknown }).result
  if (typeof result !== 'object' || result === null) return undefined
  const list = (result as { service_node_states?: unknown }).service_node_states
  return Array.isArray(list) ? (list as ServiceNodeState[]) : undefined
}

/**
 * The usable seeds in an oxend reply.
 *
 * Anything missing a field or reporting itself unreachable is dropped rather than refused: a
 * devnet part-way through starting reports exactly that, and one good node is enough to bootstrap
 * from.
 */
export function seedNodesFrom(payload: unknown): SeedNode[] {
  return (states(payload) ?? []).flatMap((state) => {
    if (state.storage_server_reachable !== true) return []
    if (typeof state.pubkey_ed25519 !== 'string' || !HEX64.test(state.pubkey_ed25519)) return []
    if (!ipv4(state.public_ip)) return []
    if (!port(state.storage_port) || !port(state.storage_lmq_port)) return []

    return [
      {
        ed25519PubkeyHex: state.pubkey_ed25519.toLowerCase(),
        ip: state.public_ip,
        httpsPort: state.storage_port,
        omqPort: state.storage_lmq_port,
      },
    ]
  })
}

/**
 * Every seed node a devnet will admit to, or an error naming the variable that points at it.
 *
 * The RPC and the storage ports are different listeners: oxend binds this one to the devnet host's
 * own address while the storage servers bind everything, so a machine that can reach the swarm can
 * still fail here.
 */
export async function discoverSeedNodes(
  seedUrl: string,
  deps: { fetch: FetchLike; variable?: string },
): Promise<SeedNode[]> {
  // A scheme is added rather than required: a bare host:port is what gets copied out of a node
  // table and what the sample environment says is accepted, and `fetch` refuses it outright.
  const base = /^[a-z][a-z0-9+.-]*:\/\//i.test(seedUrl) ? seedUrl : `http://${seedUrl}`
  const endpoint = `${base.replace(/\/+$/, '')}/json_rpc`
  const variable = deps.variable ?? 'the devnet seed URL'

  let payload: unknown
  try {
    const response = await deps.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REQUEST),
    })
    if (!response.ok)
      throw new Error(`it answered ${String(response.status)} rather than a service node list`)
    payload = await response.json()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Could not reach the devnet's oxend RPC at ${endpoint}: ${reason}. ${variable} points at it.`,
      { cause: error },
    )
  }

  if (states(payload) === undefined)
    throw new Error(
      `${endpoint} answered, but not like an oxend RPC: no result.service_node_states. Check ${variable} names the RPC port.`,
    )

  const seeds = seedNodesFrom(payload)
  if (seeds.length === 0)
    throw new Error(
      `The devnet at ${endpoint} reported no usable service node: each needs to be reachable and to report a pubkey, an IPv4 address and both storage ports. One still starting up reports exactly this.`,
    )

  return seeds
}
