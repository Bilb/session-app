import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/** A source file as the compiler sees it, for the contracts below. */
function parse(relative: string): ts.SourceFile {
  const path = join(import.meta.dirname, '../src', relative)
  return ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
}

/** Whether a file calls a function of this name anywhere. */
function calls(source: ts.SourceFile, name: string): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name
    )
      found = true
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/**
 * Every Export Logs button hands the export its config sizes.
 *
 * Without them the export still works and its header says `unknown`, which is also what a failed
 * start honestly reports - so a button that stopped passing them would look exactly like one whose
 * start failed, and nothing else would notice. Parsed rather than rendered, as the other screen
 * contracts are: what matters is the call, and the compiler already knows its shape.
 */
describe('exporting logs', () => {
  it('passes the store’s config sizes and cache limit to every export it starts', () => {
    const source = parse('useExportLogs.ts')
    const exportCalls: ts.CallExpression[] = []
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'exportLogs'
      ) {
        exportCalls.push(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)

    expect(exportCalls.length).toBeGreaterThan(0)
    for (const call of exportCalls) {
      const [sources] = call.arguments
      expect(sources !== undefined && ts.isObjectLiteralExpression(sources)).toBe(true)
      const configSizes = (sources as ts.ObjectLiteralExpression).properties.find(
        (property) =>
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === 'configSizes',
      )
      expect(configSizes?.getText(source)).toBe('configSizes: actions.getConfigSizes')
      const attachmentsLimit = (sources as ts.ObjectLiteralExpression).properties.find(
        (property) =>
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === 'attachmentsLimit',
      )
      expect(attachmentsLimit?.getText(source)).toContain('actions.getCacheSettings()')
    }
  })

  it('is started through useExportLogs on every screen with the button', () => {
    for (const screen of ['StartupFailedScreen.tsx', 'settings/HelpPage.tsx']) {
      const source = parse(screen)
      expect(calls(source, 'useExportLogs')).toBe(true)
      expect(calls(source, 'exportLogs')).toBe(false)
    }
  })
})
