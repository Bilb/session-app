import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const appDir = fileURLToPath(new URL('.', import.meta.url))

/**
 * `.web.js` ahead of `.js`, which is how the react-native-web ecosystem ships a DOM flavour beside
 * a native one. `react-native-svg` - which the icons draw through - is one of the packages that
 * does, and it has no exports map and no `browser` field, so no condition list can reach its web
 * build. Only the extension order can.
 *
 * It has to be given to esbuild as well as to vite. Vite's own resolver reads `resolve.extensions`,
 * but the dependency pre-bundler is esbuild with its own, so left to itself the dev server walks
 * into the native flavour, follows it to `react-native/Libraries/...`, and fails to start on a path
 * the `react-native` alias has rewritten to one that does not exist. The built app resolves
 * correctly either way, which is a good way not to notice.
 */
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
 * The renderer draws react-native components through react-native-web, so the aliases
 * below are what let @session/ui and @session/screens - written once, in
 * react-native's vocabulary - render in a browser window.
 *
 * @tamagui/vite-plugin is deliberately absent: it peers on vite 8 and electron-vite is on
 * 7. It is an optimising compiler rather than a requirement, so the app runs without it.
 */
/**
 * The workspace packages ship raw TypeScript - that is what makes editing a screen show up
 * in both apps without a build step - so every build here has to bundle them rather than
 * leave them as imports Node would choke on at runtime.
 */
const workspacePackages = [
  '@session/app',
  '@session/basic-types',
  '@session/bridge-node',
  '@session/client',
  '@session/localization',
  '@session/proto',
  '@session/state',
]

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: `${appDir}out/renderer`,
      emptyOutDir: true,
      rollupOptions: { input: 'src/renderer/index.html' },
    },
    resolve: {
      alias: { 'react-native': 'react-native-web' },
      // Tamagui ships both; the web build has to win here or the DOM flavour never loads.
      mainFields: ['module', 'browser', 'main'],
      conditions: ['browser', 'import', 'default'],
      extensions: WEB_FIRST_EXTENSIONS,
    },
    optimizeDeps: {
      esbuildOptions: { resolveExtensions: WEB_FIRST_EXTENSIONS },
    },
    define: {
      // The same variable the main process reads to choose the netid (see src/main/bridge.ts), so
      // the overlay and the network libsession actually attached to cannot disagree. Spelled the
      // same on both sides - `import.meta.env` rather than a global of its own, because two names
      // for one variable is one more than anybody will remember.
      'import.meta.env.SESSION_NETID': JSON.stringify(process.env['SESSION_NETID'] ?? 'mainnet'),
      // react-native-web reads these; without them the bundle throws on first render.
      global: 'globalThis',
      __DEV__: JSON.stringify(process.env['NODE_ENV'] !== 'production'),
      'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] ?? 'development'),
    },
    plugins: [react()],
  },
})
