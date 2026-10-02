/**
 * The graph as Metro resolves it, `.native` first.
 *
 * root.cjs resolves the way the desktop bundle does, so it never reaches a `.native` file and
 * cannot tell a live one from a dead one. Cycles are checked again because which file an import
 * lands on decides whether there is one.
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
