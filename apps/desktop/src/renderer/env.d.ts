/**
 * What electron.vite.config.ts substitutes into the renderer bundle.
 *
 * Declared rather than pulled in with vite/client: the renderer's tsconfig lists its types
 * explicitly, and this is the only one of vite's it uses.
 */
interface ImportMetaEnv {
  /** The Session network this build talks to. See parseNetworkName. */
  readonly EXPO_PUBLIC_SESSION_NETID?: string
  /**
   * Every `SESSION_FLAG_*` variable present when the renderer was built, keyed by name.
   *
   * An object rather than one entry per flag, because the flag table is shared code and the
   * config collects by prefix: a flag added there must not also need a line here.
   */
  readonly SESSION_FLAGS?: Record<string, string>
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
