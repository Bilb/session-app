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
}
