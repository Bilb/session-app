import { baseConfig, sharedZone } from '@s2/eslint-config'

export default [
  // src/localization-src is the session-localization submodule: generated and maintained in
  // its own repo. We lint what we wrote, not what we vendored.
  { ignores: ['src/localization-src/**'] },
  ...baseConfig({ tsconfigRootDir: import.meta.dirname, zone: sharedZone }),
]
