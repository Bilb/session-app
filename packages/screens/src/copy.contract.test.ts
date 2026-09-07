import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Every word a person reads comes from the catalogue.
 *
 * Not a style rule. A literal in a screen ships English to everybody, and it does it silently -
 * nothing renders wrong, nothing throws, and the first sign of it is somebody reading English in
 * an app they set to German. Three of these had already got in before anyone looked.
 *
 * Parsed rather than grepped because the two things worth catching look nothing alike in text: a
 * bare JSX child (`<Text>Hello</Text>`) and a string handed to a prop that ends up on screen
 * (`placeholder="Hello"`). The compiler already knows which is which.
 *
 * What counts as fine is anything that is not a literal: `{tr('x')}` obviously, but also
 * `{account.name}` or `{count}`, because a value is not copy. The check is deliberately about
 * where the *words* come from, not about spelling `tr` at the call site.
 */

/** Props whose string value is rendered, or read out, rather than used as a value. */
const COPY_PROPS = new Set([
  'placeholder',
  'accessibilityLabel',
  'accessibilityHint',
  'title',
  'label',
])

/**
 * Copy that predates this test and has no key in the catalogue to move to.
 *
 * Adding a catalogue entry is a translation-pipeline decision rather than a code one, so these
 * stay listed until somebody makes it. The list is the point: it is short, it is visible, and a
 * new literal cannot hide in it - anything not named here fails.
 */
const NOT_YET_IN_THE_CATALOGUE = new Set([
  'No conversations yet',
  'No account on this device yet.',
  'No account yet',
  // Diagnostics rather than copy so far: the settings screen shows whether the bridge attached,
  // which is a thing a developer reads. If it stays on screen for users it needs keys like the
  // rest.
  'Network',
  'Attached',
  'Not attached',
])

const dir = import.meta.dirname

function screenFiles(from: string): string[] {
  return readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name)
    if (entry.isDirectory()) return screenFiles(path)
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : []
  })
}

/** Every rendered literal in one file, as `path:line text`. */
function literalsIn(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const found: string[] = []

  const report = (node: ts.Node, text: string) => {
    const trimmed = text.trim()
    // Punctuation and whitespace between elements is not copy: a bare `-` or `·` has nothing to
    // translate, and demanding a key for one would be the rule wearing out its welcome.
    if (!/\p{Letter}/u.test(trimmed)) return
    if (NOT_YET_IN_THE_CATALOGUE.has(trimmed)) return
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    found.push(`${path.slice(path.indexOf('packages/'))}:${String(line + 1)} ${trimmed}`)
  }

  const walk = (node: ts.Node) => {
    if (ts.isJsxText(node)) report(node, node.text)
    if (ts.isJsxAttribute(node) && COPY_PROPS.has(node.name.getText(source))) {
      const value = node.initializer
      if (value && ts.isStringLiteral(value)) report(value, value.text)
      if (
        value &&
        ts.isJsxExpression(value) &&
        value.expression &&
        ts.isStringLiteral(value.expression)
      )
        report(value.expression, value.expression.text)
    }
    ts.forEachChild(node, walk)
  }

  walk(source)
  return found
}

describe('screen copy', () => {
  const files = screenFiles(dir)

  it('reads some screens at all', () => {
    // Without this the assertion below would pass over an empty list and prove nothing.
    expect(files.length).toBeGreaterThan(3)
  })

  it('takes every word from @session/localization', () => {
    const offenders = files.flatMap(literalsIn)
    expect(
      offenders,
      'Hardcoded copy. Use tr() with a key from @session/localization; if no key fits, that is a ' +
        'question for the translation pipeline rather than a string to invent here.',
    ).toEqual([])
  })
})
