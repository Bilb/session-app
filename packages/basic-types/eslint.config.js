import { baseConfig, sharedZone } from '@s2/eslint-config'

export default [...baseConfig({ tsconfigRootDir: import.meta.dirname }), { rules: sharedZone }]
