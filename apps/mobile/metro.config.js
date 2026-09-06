const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

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
