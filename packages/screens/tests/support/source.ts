import { readFileSync } from 'node:fs'

import ts from 'typescript'

/**
 * A source file as the compiler sees it, for the contract tests that read a screen rather than
 * render it: what they check is a call or a literal, and the compiler already knows its shape.
 */
export function parseSource(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

/** Every call in `source` to a function of this name, in source order. */
export function findCalls(source: ts.SourceFile, name: string): ts.CallExpression[] {
  const found: ts.CallExpression[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name
    ) {
      found.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
