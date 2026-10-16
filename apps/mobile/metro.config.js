const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const { commitStamp, libsessionStamp } = require('@session/build-stamp')

// Put in the environment before anything is transformed, which is what lets Metro inline them as
// it does any `EXPO_PUBLIC_` variable. Empty outside a git checkout.
process.env.EXPO_PUBLIC_SESSION_BUILD_COMMIT = commitStamp(projectRoot) ?? ''
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
process.env.EXPO_PUBLIC_SESSION_LIBSESSION_COMMIT = libsessionStamp(workspaceRoot) ?? ''

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
