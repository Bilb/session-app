import { fileURLToPath } from 'node:url'

import type { TestProjectInlineConfiguration } from 'vitest/config'

/** As the desktop renderer resolves: see apps/desktop/electron.vite.config.ts. */
const WEB_FIRST_EXTENSIONS = [
  '.web.mjs',
  '.web.js',
  '.web.tsx',
  '.web.ts',
  '.mjs',
  '.js',
  '.mts',
  '.ts',
  '.jsx',
  '.tsx',
  '.json',
]

/**
 * The `render` project: every `.test.tsx` under `tests/`, drawn through react-native-web in
 * happy-dom as the desktop renderer draws it. `config` is the calling vitest config's own URL.
 */
export function renderProject(config: string): TestProjectInlineConfiguration {
  const src = fileURLToPath(new URL('./src', config))
  return {
    extends: true,
    resolve: {
      alias: [
        { find: /^react-native$/, replacement: 'react-native-web' },
        // As the desktop renderer resolves it: React Native no longer installs this from 0.88.
        {
          find: /^@react-native\/assets-registry\/registry$/,
          replacement: 'react-native-web/dist/modules/AssetRegistry',
        },
        // vite takes only the first of the `#src/*` targets, which misses every .tsx.
        { find: /^#src\/(.*)$/, replacement: `${src}/$1` },
      ],
      mainFields: ['module', 'browser', 'main'],
      conditions: ['browser', 'import', 'default'],
      extensions: WEB_FIRST_EXTENSIONS,
    },
    test: {
      name: 'render',
      include: ['tests/**/*.test.tsx'],
      environment: 'happy-dom',
      // Inlined so vite resolves them with the aliases above, rather than Node with its own.
      server: { deps: { inline: [/tamagui/, /react-native-web/, /react-native-svg/] } },
    },
  }
}

/** The `unit` project: every `.test.ts` under `tests/`, in Node. */
export const UNIT_PROJECT: TestProjectInlineConfiguration = {
  extends: true,
  test: { name: 'unit', include: ['tests/**/*.test.ts'], environment: 'node' },
}
