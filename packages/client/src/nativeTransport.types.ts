/**
 * What a platform needs to open the real bridge.
 *
 * Shared by the two implementations so they cannot drift: the mobile one links the Nitro
 * module, and the other exists to say that there isn't one here.
 */
export interface NativeTransportOptions {
  dbPath: string
  cacheDir: string
  /** The 32-byte database key, hex. libsession takes one but neither derives nor stores it. */
  rawKeyHex?: string
  /** The fallback where there is no keychain to keep a key in. */
  password?: string
  /** Opens without creating an account, so onboarding gets to ask. */
  deferAccount?: boolean
  /** 'mainnet' or 'testnet'. Left out, the bridge never attaches a network at all. */
  netid?: 'mainnet' | 'testnet'
  /** What the account's other devices are told this is. */
  deviceType?: 'ios' | 'android'
  /** How much of libsession's own logging to forward as `log` events. */
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical'
}
