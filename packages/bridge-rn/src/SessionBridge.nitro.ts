import type { HybridObject } from 'react-native-nitro-modules'

/** Everything the bridge needs to open a Client, and nothing it can work out for itself. */
export interface SessionBridgeOptions {
  dbPath: string
  cacheDir: string
  /**
   * The 32-byte database key, hex. libsession accepts one but neither derives nor stores it,
   * so custody is the app's: generated at first boot and kept in the OS keychain.
   */
  rawKeyHex?: string
  /** The fallback where there is no keychain to keep a key in. */
  password?: string
  /**
   * Opens without creating an account, so onboarding gets to ask. Without it libsession makes
   * one as the database opens and the app has decided for the user before drawing anything.
   */
  deferAccount: boolean
  /**
   * Which network to reach: 'mainnet' or 'testnet'. Empty means never attach one, which is the
   * whole of the offline guarantee.
   */
  netid: string
  /** What the account's other devices are told this is: 'ios' or 'android'. */
  deviceType: string
}

/**
 * The bridge, as JSI sees it.
 *
 * Three methods and one callback — the same surface the N-API addon exposes, because both are
 * transports in front of the same shim and neither is allowed an opinion of its own.
 *
 * `setSink` before `init`: libsession publishes the state it already has while the Client is
 * being constructed, so a sink installed afterwards has already missed the first frames.
 */
export interface SessionBridge extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  setSink(onFrame: (frame: ArrayBuffer) => void): void
  init(options: SessionBridgeOptions): void
  call(request: ArrayBuffer): void
  close(): void
}
