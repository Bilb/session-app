/**
 * What electron.vite.config.ts substitutes into the renderer bundle.
 *
 * Declared rather than pulled in with vite/client: the renderer's tsconfig lists its types
 * explicitly, and this is the only one of vite's it uses.
 */
interface ImportMetaEnv {
  /** The Session network this build talks to. See parseNetworkName. */
  readonly EXPO_PUBLIC_SESSION_NETID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
