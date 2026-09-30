import {
  baseConfig,
  desktopMainIpcRules,
  desktopMainZone,
  desktopRendererZone,
} from '@session/eslint-config'

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  { files: ['src/main/**', 'src/preload/**'], rules: desktopMainZone },
  { files: ['src/main/**'], rules: desktopMainIpcRules },
  { files: ['src/renderer/**'], rules: desktopRendererZone },
]
