import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const appDir = fileURLToPath(new URL('.', import.meta.url))

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
      // `.web.js` ahead of `.js` is how the react-native-web ecosystem ships a DOM flavour, and
      // react-native-svg - which the icons draw through - is one of the packages that does. It has
      // no exports map and no browser field, so the condition list above cannot reach its web
      // build; only the extension order can. Without this the renderer loads the native flavour
      // and every icon throws on a host component the DOM does not have.
      extensions: [
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
      ],
    },
    define: {
      // Icons resolve their colour to a value rather than to a CSS variable.
      //
      // @tamagui/helpers-icon reads this when each icon is themed, and its default - `auto` -
      // means "a var() on the web", which assumes the theme's custom properties are defined.
      // Emitting those is the vite plugin's job, and the plugin is deliberately absent above, so
      // `var(--textSecondary)` names nothing and the SVG's stroke computes to `none`: an icon that
      // is present, sized and completely invisible. Every other component already resolves its
      // colours at runtime, so this only asks the icons to do what the rest of the app does.
      'process.env.TAMAGUI_ICON_COLOR_RESOLVE': JSON.stringify('value'),
      // react-native-web reads these; without them the bundle throws on first render.
      global: 'globalThis',
      __DEV__: JSON.stringify(process.env['NODE_ENV'] !== 'production'),
      'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] ?? 'development'),
    },
    plugins: [react()],
  },
})
