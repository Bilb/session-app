import { baseConfig, sharedZone } from '@session/eslint-config'

export default baseConfig({ tsconfigRootDir: import.meta.dirname, zone: sharedZone })
