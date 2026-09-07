/**
 * The networks libsession will attach to.
 *
 * devnet exists upstream and the shim refuses it on purpose: it takes seed node details, which is
 * a public key, an address and two ports per node, and none of that fits in a name. Offering it
 * here would be offering something that always throws.
 */
export type NetId = 'mainnet' | 'testnet'

/**
 * What the account's other devices are told this is.
 *
 * All three on every transport, because a transport is not a device: nothing on mobile has any
 * reason to say 'desktop', but the shim maps all three and narrowing the JSI copy would take an
 * `Exclude<>`, which nitrogen refuses because it only reads a named alias.
 */
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

  /** Left out, this device is not published to the account's device list. */
  deviceType?: DeviceType

  /**
   * Left out, none of it is forwarded. Worth turning up when something fails for no visible
   * reason: the send state machine says what happened and never why.
   */
  logLevel?: LibsessionLogLevel
}
