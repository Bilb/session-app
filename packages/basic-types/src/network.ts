/**
 * Which Session network a build talks to.
 *
 * Here rather than beside the ports it is read through, because one of its three readers is
 * Electron's main process, which cannot import a package that pulls in React.
 */
export type NetworkName = 'mainnet' | 'testnet' | 'devnet'

/**
 * Reads `SESSION_NETID` into a network name, for whoever is doing the reading.
 *
 * One function because every app has two readers that must not diverge: the transport, which
 * decides what libsession attaches to, and the overlay, which tells a person what that was. Parse
 * the variable twice and a build can attach to one network while the stamp names another.
 *
 * An unrecognised value is mainnet, because unset has to be and there is nothing better to do with
 * a typo.
 */
export function parseNetworkName(value: string | undefined): NetworkName {
  return value === 'testnet' || value === 'devnet' ? value : 'mainnet'
}

/**
 * One node to bootstrap a devnet from.
 *
 * `ip` is a dotted quad because libsession dials it itself and resolves no host names anywhere, so
 * a name here never becomes anything.
 */
export interface SeedNode {
  /** Ed25519, 64 hex characters. Not the X25519 key a session id is built from. */
  ed25519PubkeyHex: string
  ip: string
  httpsPort: number
  omqPort: number
}

/** A file server that is not the built-in one. */
export interface FileServerConfig {
  scheme: 'http' | 'https'
  host: string
  port: number
  /**
   * The server's **X25519** pubkey, hex, which is what libsession encrypts onion requests to it
   * with. The devnet container advertises its Ed25519 key first and the X25519 one beside it; the
   * two are indistinguishable once pasted, and the wrong one fails as a decryption error mid
   * upload rather than as anything this can catch.
   */
  x25519PubkeyHex: string
}

/**
 * Where a local Pro backend lives.
 *
 * Carried and consumed by nothing: libsession hardcodes the Pro backend's URL and pubkey as
 * `constexpr` with no override, and nothing in this repository talks to one yet. Parsed anyway so
 * the value is checked where it is written rather than the day Pro arrives.
 */
export interface ProBackendConfig {
  url: string
  ed25519PubkeyHex: string
}

/** What a devnet build needs told beyond its name, none of which has a sensible default. */
export interface DevnetConfig {
  /** The seed node's oxend RPC, canonicalised to `http://host:port`. */
  seedUrl: string
  fileServer?: FileServerConfig
  proBackend?: ProBackendConfig
}

/** The raw strings a devnet build is configured with, read by each app under its own prefix. */
export interface DevnetEnv {
  seedUrl: string | undefined
  fileServerUrl: string | undefined
  fileServerX25519Pubkey: string | undefined
  proBackendUrl: string | undefined
  proBackendEd25519Pubkey: string | undefined
}

const DEFAULT_SEED_RPC_PORT = 1280
const HEX64 = /^[0-9a-f]{64}$/i

/** The trimmed value, or undefined for both unset and whitespace: a blank line in a .env is unset. */
function set(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed
}

function pubkey(value: string, variable: string): string {
  if (!HEX64.test(value.trim()))
    throw new Error(`${variable} must be 64 hex characters, not ${JSON.stringify(value)}`)
  return value.trim().toLowerCase()
}

/**
 * Splits `scheme://host:port/rest` with the scheme, the port and the path all optional.
 *
 * Hand-rolled because this package typechecks with no DOM and no node types, where `URL` does not
 * exist - and it is the one package the Electron main process, the renderer and Hermes all read.
 */
const ADDRESS = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/:?#]+)(?::(\d+))?(?:[/?#].*)?$/i

interface Address {
  scheme: string | undefined
  host: string
  port: number | undefined
}

function address(value: string, variable: string): Address {
  const match = ADDRESS.exec(value)
  if (match === null) throw new Error(`${variable} is not an address: ${JSON.stringify(value)}`)

  const [, scheme, host, port] = match
  if (host === undefined || host.length === 0)
    throw new Error(`${variable} has no host: ${JSON.stringify(value)}`)
  if (scheme !== undefined && scheme.toLowerCase() !== 'http' && scheme.toLowerCase() !== 'https')
    throw new Error(`${variable} must be http or https, not ${scheme}`)

  const number = port === undefined ? undefined : Number(port)
  if (number !== undefined && (number < 1 || number > 65535))
    throw new Error(`${variable} names no port: ${port}`)

  return { scheme: scheme?.toLowerCase(), host, port: number }
}

/**
 * Canonicalises the seed node's oxend RPC address.
 *
 * A bare host, `host:port` and `http://host:port` are all accepted because all three are what gets
 * copied out of a node table. The port defaults rather than being required: a devnet built by the
 * standard compose puts oxend's RPC on 1280.
 */
function seedUrl(value: string, variable: string): string {
  const { scheme, host, port } = address(value, variable)
  return `${scheme ?? 'http'}://${host}:${port ?? DEFAULT_SEED_RPC_PORT}`
}

function fileServer(url: string, key: string, variable: string): FileServerConfig {
  const { scheme, host, port } = address(url, variable)
  if (port === undefined)
    throw new Error(`${variable} must name a port: a devnet's file server is not on 80`)

  return {
    scheme: scheme === 'https' ? 'https' : 'http',
    host,
    port,
    x25519PubkeyHex: key,
  }
}

/**
 * Turns a devnet build's environment into what the bridge needs, or says which variable is wrong.
 *
 * Every refusal names the variable, because these are set once in a file nobody looks at again and
 * libsession's own errors name none of them: a bad seed pubkey throws out of `from_hex` and a host
 * name where an address belongs throws out of libquic, both far below anything that knows the
 * value came from `SESSION_DEVNET_SEED_URL`.
 *
 * Takes the values rather than the environment: Metro only inlines `process.env.EXPO_PUBLIC_X`
 * where the name is written out literally, so each app has to do its own reading.
 */
export function parseDevnetConfig(env: DevnetEnv, prefix: string): DevnetConfig {
  const seed = set(env.seedUrl)
  if (seed === undefined)
    throw new Error(
      `${prefix}NETID is devnet but ${prefix}DEVNET_SEED_URL is not set. It is the seed node's ` +
        `oxend RPC: a bare host, host:port, or http://host:port, port ${DEFAULT_SEED_RPC_PORT} ` +
        `by default.`,
    )

  const config: DevnetConfig = { seedUrl: seedUrl(seed, `${prefix}DEVNET_SEED_URL`) }

  // Both or neither, because half of it silently leaves the *mainnet* file server in place: only
  // testnet has one of its own, so a devnet uploads to production storage and says nothing.
  const fsUrl = set(env.fileServerUrl)
  const fsKey = set(env.fileServerX25519Pubkey)
  if ((fsUrl === undefined) !== (fsKey === undefined))
    throw new Error(
      `${prefix}FILE_SERVER_URL and ${prefix}FILE_SERVER_X25519_PUBKEY go together: with one ` +
        `missing, uploads would go to the mainnet file server instead of the devnet's.`,
    )
  if (fsUrl !== undefined && fsKey !== undefined)
    config.fileServer = fileServer(
      fsUrl,
      pubkey(fsKey, `${prefix}FILE_SERVER_X25519_PUBKEY`),
      `${prefix}FILE_SERVER_URL`,
    )

  const proUrl = set(env.proBackendUrl)
  const proKey = set(env.proBackendEd25519Pubkey)
  if ((proUrl === undefined) !== (proKey === undefined))
    throw new Error(`${prefix}PRO_BACKEND_URL and ${prefix}PRO_BACKEND_ED25519_PUBKEY go together.`)
  if (proUrl !== undefined && proKey !== undefined)
    config.proBackend = {
      url: proUrl,
      ed25519PubkeyHex: pubkey(proKey, `${prefix}PRO_BACKEND_ED25519_PUBKEY`),
    }

  return config
}

/**
 * What to hand the transport, or nothing.
 *
 * A devnet with nothing configured attaches nothing at all, never mainnet: falling back would put
 * real traffic on a build whose owner believes it is a sandbox, and the overlay stamping `devnet`
 * over that would confirm the belief rather than contradict it.
 */
export function netidForTransport(
  name: NetworkName,
  devnet: DevnetConfig | undefined,
): NetworkName | undefined {
  return name === 'devnet' && devnet === undefined ? undefined : name
}
