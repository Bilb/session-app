import { baseConfig, uiZone } from '@session/eslint-config'

export default baseConfig({ tsconfigRootDir: import.meta.dirname, zone: uiZone })
