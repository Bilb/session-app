import { baseConfig, mobileAppZone, mobileStorageZone } from '@session/eslint-config'

export default [
  { ignores: ['.expo/**', 'android/**', 'ios/**', 'metro.config.js', 'babel.config.js'] },
  ...baseConfig({ tsconfigRootDir: import.meta.dirname, zone: mobileAppZone }),
  // The one place the file system may be imported: see src/storage/roots.ts.
  { files: ['src/storage/**'], rules: mobileStorageZone },
]
