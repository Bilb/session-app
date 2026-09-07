import { configs } from 'eslint-plugin-pnpm'

/**
 * Manifest lint, run from the repo root by `pnpm lint:manifests`.
 *
 * Versions are written once in pnpm-workspace.yaml's catalog and referenced as "catalog:".
 * These rules are what stop a package quietly pinning its own copy of react and hoisting a
 * second one beside Expo's - the exact failure the catalog exists to prevent. The yaml half
 * checks the catalog back: an entry nothing references is an entry that has rotted.
 */
export default [...configs.json, ...configs.yaml]
