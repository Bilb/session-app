const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')

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

/**
 * The libsession commit, stamped like the app's, as `libsessionStamp` in
 * `apps/desktop/electron.vite.config.ts` does it.
 *
 * From the submodule's own checkout where there is one, since that is what was built, and mid-bump
 * it can differ from the commit the app pins. A submodule never checked out is an empty directory
 * inside the app's checkout, where git answers with the app's own commit, so there the stamp is
 * the commit the app pins instead.
 */
function libsessionStamp() {
  const libsessionDir = path.resolve(workspaceRoot, 'libsession-util')
  if (existsSync(path.join(libsessionDir, '.git'))) return commitStamp(libsessionDir)
  try {
    return execFileSync('git', ['rev-parse', 'HEAD:libsession-util'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .slice(0, 8)
  } catch {
    return ''
  }
}

process.env.EXPO_PUBLIC_SESSION_BUILD_COMMIT = commitStamp()
// Every flag variable, as one, so the startup block can name one the flag table does not have:
// Metro inlines only the names `src/flagOverrides.ts` spells out.
process.env.EXPO_PUBLIC_SESSION_FLAGS = JSON.stringify(
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith('EXPO_PUBLIC_SESSION_FLAG_')),
  ),
)
// libsession is the client, so a log has to say which one. The native libraries are built from the
// submodule, so this is the commit they were built from as long as they were rebuilt after it last
// moved.
process.env.EXPO_PUBLIC_SESSION_LIBSESSION_COMMIT = libsessionStamp()

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
