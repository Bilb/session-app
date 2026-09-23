/** A workspace package, as far as the manifest rule needs to know it. */
export interface WorkspacePackage {
  name: string
  /** Relative to the repo root. */
  directory: string
  /** Every workspace package its manifest names, in any dependency field. */
  declared: ReadonlySet<string>
  /** Its source files, with their text. Paths relative to the repo root. */
  sources: readonly { path: string; text: string }[]
}

export interface UndeclaredImport {
  package: string
  file: string
  imports: string
}

/** A static import, a re-export, a dynamic import or a require of a `@session/*` package. */
const SIBLING =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"](@session\/[\w.-]+)/gm

/**
 * Imports of a sibling the importing package does not declare.
 *
 * **Every such import resolves anyway**, which is why nothing else catches it: the hoisted layout
 * links every workspace package at the root, and tsconfig paths map the siblings to their source,
 * so typecheck and lint pass. It fails only when a bundler resolves from the package itself -- and
 * before that, turbo has already got it wrong, because `^build` and a task's cache key follow the
 * declared graph: a sibling nobody declared is neither built first nor hashed.
 */
export function undeclaredImports(packages: readonly WorkspacePackage[]): UndeclaredImport[] {
  const found: UndeclaredImport[] = []
  for (const pkg of packages)
    for (const source of pkg.sources)
      for (const [, imported] of source.text.matchAll(SIBLING)) {
        if (imported === undefined || imported === pkg.name || pkg.declared.has(imported)) continue
        found.push({ package: pkg.name, file: source.path, imports: imported })
      }
  return found
}
