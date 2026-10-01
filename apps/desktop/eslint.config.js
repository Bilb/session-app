import {
  baseConfig,
  desktopMainIpcRules,
  desktopMainZone,
  desktopRendererZone,
  sharedZone,
} from '@session/eslint-config'

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  { files: ['src/main/**', 'src/preload/**'], rules: desktopMainZone },
  { files: ['src/main/**'], rules: desktopMainIpcRules },
  { files: ['src/renderer/**'], rules: desktopRendererZone },
  { files: ['src/shared/**'], rules: sharedZone },
]
