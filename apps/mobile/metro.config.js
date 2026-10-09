const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const { execFileSync } = require('node:child_process')

/**
 * The commit this bundle is made from, as the desktop config stamps it -- the two are kept
 * identical. See `commitStamp` in `apps/desktop/electron.vite.config.ts`.
 *
 * Put in the environment before anything is transformed, which is what lets Metro inline it as it
 * does any `EXPO_PUBLIC_` variable. Empty outside a git checkout.
 */
function commitStamp(cwd = projectRoot) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
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
    return ''
  }
}
process.env.EXPO_PUBLIC_SESSION_BUILD_COMMIT = commitStamp()
// The libsession submodule's commit, stamped the same way: libsession is the client, so a log has to
// say which one. The native libraries are built from the submodule, so this is the commit they
// were built from as long as they were rebuilt after it last moved.
process.env.EXPO_PUBLIC_SESSION_LIBSESSION_COMMIT = commitStamp(
  path.resolve(workspaceRoot, 'libsession-util'),
)

const config = getDefaultConfig(projectRoot)

/**
 * The workspace packages are consumed as source, so Metro has to watch the whole repo
 * rather than just this app - that is what makes editing a screen show up here without a
 * build step.
 *
 * The hoisted node-linker in .npmrc is the other half of this: Metro cannot follow pnpm's
 * symlinked store, which is why the whole workspace uses the flat layout.
 */
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config
