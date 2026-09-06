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
}
