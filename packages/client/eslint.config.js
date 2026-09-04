import { baseConfig, sharedZone } from '@session/eslint-config'

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname, zone: sharedZone }),
  {
    // The `.native` pair is the one place the Nitro module may be linked. Turned off wholesale
    // rather than narrowed, for the reason the test-file override gives: the zone matrix is
    // editor feedback, and dependency-cruiser — which is the authority — already says exactly
    // which file may reach for it.
    files: ['src/*.native.ts', 'src/*.native.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
]
