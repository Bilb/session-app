import { baseConfig, mobileAppZone } from '@session/eslint-config'

export default [
  { ignores: ['.expo/**', 'android/**', 'ios/**', 'metro.config.js', 'babel.config.js'] },
  ...baseConfig({ tsconfigRootDir: import.meta.dirname, zone: mobileAppZone }),
]
