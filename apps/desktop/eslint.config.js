import { baseConfig, desktopMainZone, desktopRendererZone } from '@s2/eslint-config'

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  { files: ['src/main/**', 'src/preload/**'], rules: desktopMainZone },
  { files: ['src/renderer/**'], rules: desktopRendererZone },
]
