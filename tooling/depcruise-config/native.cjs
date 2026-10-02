/**
 * The graph as Metro resolves it, `.native` first.
 *
 * root.cjs resolves as the desktop bundle does: a `.native` file's own imports are checked there,
 * but no import ever lands on one, which is why root once reported every `.native` file as an
 * orphan. Here an import does land on one, so cycles are checked again on the graph Metro sees,
 * and the orphan rule catches a `.native` file that imports nothing. That is all it catches: to
 * dependency-cruiser an orphan has neither dependents nor dependencies, so a dead `.native` file
 * that imports anything is not detected by this pass, and knip ignores `.native` files too.
 *
 * Only the `.native` split is resolved. Metro would also take `.ios`, `.android` and `.web`, but no
 * pass here does, so such a file is refused until a split needs it and this config learns it.
 *
 * Run: pnpm boundaries
 */
const root = require('./root.cjs')

const rule = (name) => {
  const found = root.forbidden.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`root.cjs has no rule named ${name}`)
  return found
}

module.exports = {
  forbidden: [
    rule('no-circular'),
    { ...rule('no-orphans'), from: { orphan: true, path: '\\.native\\.tsx?$' } },
  ],
  required: [
    {
      name: 'no-platform-suffix',
      comment:
        'Only .native splits are resolved; see the header before adding .ios, .android or .web.',
      severity: 'error',
      module: { path: '\\.(ios|android|web)\\.[jt]sx?$' },
      to: { path: '^$' },
    },
  ],
  options: {
    ...root.options,
    enhancedResolveOptions: {
      ...root.options.enhancedResolveOptions,
      extensions: ['.native.ts', '.native.tsx', ...root.options.enhancedResolveOptions.extensions],
    },
  },
}
