import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * The startup-failure screen hands the export its config sizes.
 *
 * Without them the export still works and its header says `unknown`, which is also what a failed
 * start honestly reports - so a screen that stopped passing them would look exactly like one whose
 * start failed, and nothing else would notice. Parsed rather than rendered, as the other screen
 * contracts are: what matters is the call, and the compiler already knows its shape.
 */
describe('the startup-failure screen', () => {
  it('passes the store’s config sizes to every export it starts', () => {
    const path = join(import.meta.dirname, '../src/StartupFailedScreen.tsx')
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const calls: ts.CallExpression[] = []
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'exportLogs'
      ) {
        calls.push(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)

    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      const [sources] = call.arguments
      expect(sources !== undefined && ts.isObjectLiteralExpression(sources)).toBe(true)
      const configSizes = (sources as ts.ObjectLiteralExpression).properties.find(
        (property) =>
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === 'configSizes',
      )
      expect(configSizes?.getText(source)).toBe('configSizes: actions.getConfigSizes')
    }
  })
})
