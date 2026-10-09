/**
 * The renderer draws react-native components through react-native-web, so the aliases
 * below are what let @session/ui and @session/screens - written once, in
 * react-native's vocabulary - render in a browser window.
 *
 * @tamagui/vite-plugin is deliberately absent: it peers on vite 8 and electron-vite is on
 * 7. It is an optimising compiler rather than a requirement, so the app runs without it.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { runnerImport } from 'vite'

import type { LAUNCH_MARK_HEIGHT, SESSION_BRAND } from '@session/ui/brandMark'

import type { launchColors } from './src/main/launchColors'
import { contentSecurityPolicy } from './src/main/security'

const appDir = fileURLToPath(new URL('.', import.meta.url))

// The renderer's network stamp is substituted at build time from this process's environment, so
// the repo-root .env has to be loaded before the define below reads it. The main process loads it
// again at runtime for its own use: an explicit variable wins in both, so the two agree.
const dotEnv = fileURLToPath(new URL('../../.env', import.meta.url))
if (existsSync(dotEnv)) process.loadEnvFile(dotEnv)

/**
 * The commit this build is made from: eight characters, and `-dirty` over uncommitted changes.
 *
 * `apps/mobile/metro.config.js` computes the same stamp for the phones; the two are kept identical
 * so a stamp means the same on every platform. A submodule counts only if its pointer moved, not
 * for work inside it. Null outside a git checkout, where there is nothing honest to say.
 */
function commitStamp(): string | null {
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: appDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  try {
    const commit = git('rev-parse', 'HEAD').trim().slice(0, 8)
    const dirty =
      git('status', '--porcelain', '--untracked-files=no', '--ignore-submodules=dirty').trim() !==
      ''
    return dirty ? `${commit}-dirty` : commit
  } catch {
    return null
  }
}

/** This app's own version, which is the one its builds are released as. */
const version = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

/**
 * The renderer loads from `file:` once packaged, where no response header can carry a CSP, so it
 * has to be a meta tag. Injected rather than written into index.html because the dev server needs
 * a looser one than the shipped app: vite inlines the react-refresh preamble and talks HMR over a
 * websocket, and both are refused by the policy the built app should have.
 */
function contentSecurityPolicyPlugin() {
  return {
    name: 'session-csp',
    transformIndexHtml: {
      order: 'pre' as const,
      handler(html: string, ctx: { server?: unknown }) {
        const policy = contentSecurityPolicy({ dev: ctx.server !== undefined })
        return html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        )
      },
    },
  }
}

/**
 * The launch screen: the brand mark, centred on the default theme, written into the page so that
 * it draws with the page's first frame rather than once the app's script has loaded.
 *
 * Generated here rather than written into index.html so that its colours and outline come from
 * the same sources as the app's: a colour or path copied by hand is one that drifts. Beside
 * `#root` rather than inside it, because React empties its root on the first render -- including
 * the render in which the theme is still being read and nothing is drawn -- and over it, until
 * the renderer removes it once the app has drawn.
 */
async function launchScreenHtml(): Promise<string> {
  // Through vite rather than imported: this file is loaded by Node with every package import left
  // to Node, and the workspace packages are TypeScript with extensionless imports, which it
  // cannot load.
  const inline = { configFile: false as const, root: appDir, logLevel: 'silent' as const }
  const [colors, brand] = await Promise.all([
    runnerImport<{ launchColors: typeof launchColors }>('./src/main/launchColors.ts', inline),
    runnerImport<{
      SESSION_BRAND: typeof SESSION_BRAND
      LAUNCH_MARK_HEIGHT: typeof LAUNCH_MARK_HEIGHT
    }>('@session/ui/brandMark', inline),
  ])
  const { background, mark } = colors.module.launchColors()
  const { width, height, path } = brand.module.SESSION_BRAND
  // `StartingScreen`'s height, which takes over from this on a slow start.
  const markHeight = brand.module.LAUNCH_MARK_HEIGHT
  const markWidth = (markHeight * width) / height
  return [
    `<div id="launch-screen" style="position: fixed; inset: 0; z-index: 1; display: flex;`,
    ` align-items: center; justify-content: center; background: ${background}">`,
    `<svg width="${markWidth}" height="${markHeight}" viewBox="0 0 ${width} ${height}"`,
    ` fill="${mark}" aria-hidden="true"><path d="${path}" /></svg></div>`,
  ].join('')
}

function launchScreenPlugin() {
  let screen: Promise<string> | null = null
  return {
    name: 'session-launch-screen',
    async transformIndexHtml(html: string) {
      const root = '<div id="root"></div>'
      if (!html.includes(root)) {
        throw new Error(`index.html has no ${root} to put the launch screen beside`)
      }
      screen ??= launchScreenHtml()
      return html.replace(root, `${root}\n    ${await screen}`)
    },
  }
}

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
 * The workspace packages ship raw TypeScript - that is what makes editing a screen show up
 * in both apps without a build step - so every build here has to bundle them rather than
 * leave them as imports Node would choke on at runtime.
 */
const workspacePackages = [
  '@session/app',
  '@session/basic-types',
  '@session/bridge-node',
  '@session/bridge-types',
  '@session/client',
  '@session/localization',
  '@session/state',
  '@session/theme-tokens',
]

/**
 * What a flag's environment variable is called, as one string rather than two.
 *
 * The shared table derives the same prefix in `envVarFor`. They were written out separately once
 * and drifted the moment the prefix changed: nothing failed, no flag was collected, and every
 * override on desktop silently read as its default.
 */
const FLAG_PREFIX = 'EXPO_PUBLIC_SESSION_FLAG_'

/**
 * Refuses to build a release with a developer's settings baked into it.
 *
 * The renderer cannot read an environment, so these are substituted here, and the badge that
 * says which network is running is substituted from the same values. A packaged build ignores
 * them at runtime -- so a release carrying one would draw a badge that disagrees with what it
 * is doing: Fake over a real network.
 *
 * Loudly rather than by substituting the default, because somebody who exported one meant
 * something by it.
 */
function refuseDeveloperSettingsInRelease(): void {
  if (process.env['NODE_ENV'] !== 'production') return
  const set = Object.keys(process.env).filter(
    (key) =>
      (key.startsWith(FLAG_PREFIX) || DEVELOPER_SETTINGS.includes(key)) &&
      process.env[key] !== undefined &&
      process.env[key] !== '',
  )
  if (set.length > 0) {
    throw new Error(
      `Refusing to build a release with developer settings in the environment: ${set.join(', ')}. ` +
        'A packaged build ignores these at runtime, so a build that carries them would draw a ' +
        'badge that disagrees with what is running. Unset them and build again.',
    )
  }
}

const DEVELOPER_SETTINGS = [
  'EXPO_PUBLIC_SESSION_FAKE',
  'EXPO_PUBLIC_SESSION_NETID',
  'EXPO_PUBLIC_SESSION_ROUTER',
  'EXPO_PUBLIC_SESSION_LOG',
  'EXPO_PUBLIC_SESSION_DEVNET_SEED_URL',
  'EXPO_PUBLIC_SESSION_FILE_SERVER_URL',
  'EXPO_PUBLIC_SESSION_FILE_SERVER_X25519_PUBKEY',
]

// Before anything below is substituted, so a release cannot carry one of them.
refuseDeveloperSettingsInRelease()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    // A sandboxed preload has to be CommonJS: Electron loads ES module preloads only with the
    // sandbox off. The main process points at the .cjs this produces.
    build: { rollupOptions: { output: { format: 'cjs' } } },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: `${appDir}out/renderer`,
      emptyOutDir: true,
      // The CSP's img-src has no data:, so an asset inlined as one would not draw.
      assetsInlineLimit: 0,
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
      // The main process reads EXPO_PUBLIC_SESSION_NETID from the environment to pick the netid;
      // the renderer cannot read the environment at all, so it gets the same value substituted
      // here. Both readers have to resolve to one value, or the overlay names a network libsession
      // never attached to.
      'import.meta.env.EXPO_PUBLIC_SESSION_NETID': JSON.stringify(
        process.env['EXPO_PUBLIC_SESSION_NETID'] ?? 'mainnet',
      ),
      // Which bridge the main process will open, substituted for the same reason: the badge that
      // says "this is the fake" must not be able to disagree with what is actually running.
      'import.meta.env.EXPO_PUBLIC_SESSION_FAKE': JSON.stringify(
        process.env['EXPO_PUBLIC_SESSION_FAKE'] ?? '',
      ),
      // Every flag variable present at build time, as one object. Collected by prefix rather than
      // listed, so adding a flag needs no change here -- which is the reason the flag table derives
      // `EXPO_PUBLIC_` on every platform rather than only on the one that needs it. A flag whose
      // name does not start with this is not collected, and a flag that is not collected reads as
      // its default with nothing said.
      'import.meta.env.EXPO_PUBLIC_SESSION_FLAGS': JSON.stringify(
        Object.fromEntries(
          Object.entries(process.env).filter(
            ([key, value]) => key.startsWith(FLAG_PREFIX) && value !== undefined,
          ),
        ),
      ),
      // Which build this is, for the settings stamp and anything that has to name its binary.
      // Read here because the renderer can reach neither git nor its own manifest.
      'import.meta.env.EXPO_PUBLIC_SESSION_BUILD_VERSION': JSON.stringify(version),
      'import.meta.env.EXPO_PUBLIC_SESSION_BUILD_COMMIT': JSON.stringify(commitStamp()),
      // react-native-web reads these; without them the bundle throws on first render.
      global: 'globalThis',
      __DEV__: JSON.stringify(process.env['NODE_ENV'] !== 'production'),
      'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] ?? 'development'),
    },
    plugins: [react(), contentSecurityPolicyPlugin(), launchScreenPlugin()],
  },
})
