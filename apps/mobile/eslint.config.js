import { baseConfig, mobileAppZone } from '@s2/eslint-config'

export default [
  { ignores: ['.expo/**', 'android/**', 'ios/**', 'metro.config.js', 'babel.config.js'] },
  ...baseConfig({ tsconfigRootDir: import.meta.dirname, zone: mobileAppZone }),
]
