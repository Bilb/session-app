/**
 * Describes this package to React Native's autolinking.
 *
 * Declared rather than left to discovery: autolinking's heuristics did not pick up a workspace
 * package linked into an app's node_modules, and a module that is silently not linked fails at
 * runtime with "SessionBridge does not exist" rather than at build time.
 */
export default {
  dependency: {
    platforms: {
      android: { sourceDir: 'android' },
      ios: { podspecPath: 'SessionBridgeRN.podspec' },
    },
  },
}
