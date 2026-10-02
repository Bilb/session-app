import { describe, expect, it } from 'vitest'

import { undeclaredImports, type WorkspacePackage } from '#src/manifests'

function pkg(text: string, declared: string[] = []): WorkspacePackage {
  return {
    name: '@session/desktop',
    directory: 'apps/desktop',
    declared: new Set(declared),
    sources: [{ path: 'apps/desktop/src/renderer/App.tsx', text }],
  }
}

describe('undeclaredImports', () => {
  /**
   * Typecheck and lint pass on this; a bundler resolving from the package, as electron-vite does,
   * does not.
   */
  it('finds a sibling imported without being declared', () => {
    expect(undeclaredImports([pkg("import { tr } from '@session/localization'\n")])).toEqual([
      {
        package: '@session/desktop',
        file: 'apps/desktop/src/renderer/App.tsx',
        imports: '@session/localization',
      },
    ])
  })

  it('accepts a declared sibling, and a package importing itself', () => {
    const text = "import { tr } from '@session/localization'\nimport x from '@session/desktop'\n"
    expect(undeclaredImports([pkg(text, ['@session/localization'])])).toEqual([])
  })

  it('reads every form an import takes', () => {
    const text = [
      "import type { A } from '@session/a'",
      "export { B } from '@session/b'",
      "const c = await import('@session/c')",
      "const d = require('@session/d')",
      "import '@session/e'",
      'import {',
      '  F,',
      "} from '@session/f/sub'",
    ].join('\n')
    expect(undeclaredImports([pkg(text)]).map((found) => found.imports)).toEqual([
      '@session/a',
      '@session/b',
      '@session/c',
      '@session/d',
      '@session/e',
      '@session/f',
    ])
  })

  it('ignores packages outside the workspace scope', () => {
    expect(undeclaredImports([pkg("import { View } from 'react-native'\n")])).toEqual([])
  })
})
