/**
 * The networks libsession will attach to.
 *
 * devnet is the one that cannot be reached by name: libsession ships mainnet's and testnet's seed
 * lists and lets neither be replaced, so a devnet has to be handed `seedNodes` as well.
 */
export type NetId = 'mainnet' | 'testnet' | 'devnet'

/**
 * One node to bootstrap a devnet from.
 *
 * Declared here rather than taken from @session/basic-types, which is where the environment that
 * supplies it is parsed: nitrogen generates the C++ struct by reading this package, so it may not
 * import one. The two are structurally identical and the apps assign across, which is what checks
 * they stay that way.
 */
export interface SeedNode {
  /** Ed25519, 64 hex characters. Not the X25519 key a session id is built from. */
  ed25519PubkeyHex: string

  /** A dotted quad: libsession dials it itself and resolves no host names anywhere. */
  ip: string

  httpsPort: number
  omqPort: number
}

export type UrlScheme = 'http' | 'https'

/**
 * A file server that is not the built-in one.
 *
 * Left out, every network uses the built-in server for its netid - and devnet has none of its own,
 * so it would use **mainnet's**: production storage, reached over a sandbox, with nothing
 * afterwards to show it happened.
 */
export interface FileServerConfig {
  scheme: UrlScheme
  host: string
  port: number

  /**
   * The server's **X25519** pubkey, which is what onion requests to it are encrypted with, and a
   * different key from the Ed25519 one its QUIC endpoint is identified by.
   */
  x25519PubkeyHex: string
}

/**
 * What the account's other devices are told this is.
 *
 * All three on every transport, because a transport is not a device: nothing on mobile has any
 * reason to say 'desktop', but the shim maps all three and narrowing the JSI copy would take an
 * `Exclude<>`, which nitrogen refuses because it only reads a named alias.
 */
/**
 * How requests reach the network.
 *
 * Session Router is what mainnet and testnet ship, and is the default for both. Onion requests are
 * the other production path and the only one a devnet has - Session Router refuses a devnet
 * outright, so devnet defaults to onion requests and cannot be moved off them.
 *
 * Settable so that the transport can be chosen independently of the network: the two paths share
 * only a ten-method interface, and uploads, downloads, connection status and retry behaviour are
 * separate implementations on each side. Without this, testing the shipped transport and using a
 * disposable network are mutually exclusive.
 */
export type RouterKind = 'onion-requests' | 'session-router'

export type DeviceType = 'ios' | 'android' | 'desktop'

/**
 * How much of libsession's own logging to forward as `log` events.
 *
 * libsession's levels, not the app's - `@session/state`'s `LogLevel` is what the app's own
 * lines are tagged with, and the two scales are deliberately separate: this one turns a
 * library's firehose up and down, that one says how much to care about a line the app wrote.
 */
export type LibsessionLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical'

/**
 * Everything the bridge needs to open a Client, and nothing it can work out for itself.
 *
 * This package exists so there is one declaration rather than one per transport. `@session/client`
 * takes it from callers and `@session/bridge-rn` hands it to JSI, and the two may not import each
 * other: client already depends on bridge-rn, and nitrogen generates the C++ struct by parsing the
 * `.nitro.ts` that uses this type, so it has to be reachable from a package that depends on
 * nothing.
 */
export interface SessionBridgeOptions {
  dbPath: string

  /** Where attachment bytes are cached. Must be writable and is the application's to clear. */
  cacheDir: string

  /** Defaults to session-router on mainnet and testnet, onion requests on devnet. */
  router?: RouterKind

  /**
   * The 32-byte database key, hex. libsession accepts one but neither derives nor stores it, so
   * custody is the app's: generated at first boot and kept in the OS keychain. With neither this
   * nor `password` the database is opened unencrypted, which is for tests.
   */
  rawKeyHex?: string

  /** The fallback where there is no keychain to keep a key in. */
  password?: string

  /**
   * Opens without creating an account, so onboarding gets to ask. Without it libsession makes one
   * as the database opens and the app has decided for the user before drawing anything.
   *
   * Required rather than defaulted: it is the one option whose absence silently creates an
   * identity, so a caller that has not thought about it should not typecheck.
   */
  deferAccount: boolean

  /**
   * Which network to reach. Left out, the bridge never attaches one, which is the whole of the
   * offline guarantee: nothing else has to remember to check.
   *
   * Attached once an account exists, so a deferred one gets its network from createAccount.
   */
  netid?: NetId

  /** Required when `netid` is devnet, which libsession has no seeds for; ignored otherwise. */
  seedNodes?: SeedNode[]

  /** Left out, uploads go to the built-in file server for the netid. */
  fileServer?: FileServerConfig

  /** Left out, this device is not published to the account's device list. */
  deviceType?: DeviceType

  /**
   * Left out, none of it is forwarded. Worth turning up when something fails for no visible
   * reason: the send state machine says what happened and never why.
   */
  logLevel?: LibsessionLogLevel
}
