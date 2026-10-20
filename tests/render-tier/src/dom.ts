import { screen } from '@testing-library/react'

import { describeNode, type DomNode } from './describeNode'
import type { ElementId } from '@session/test-ids'

/** The `at`th element carrying `id`, as a screen reader reaches it; null where there is none. */
export function nodeOf(id: ElementId, at = 0): DomNode | null {
  return describeNode(screen.queryAllByTestId(id)[at] ?? null)
}

export function byId(id: ElementId, at = 0): HTMLElement {
  const element = screen.getAllByTestId(id)[at]
  if (element === undefined) throw new Error(`No element ${String(at)} carries ${id}`)
  return element
}

type Pseudo = ':focus-visible' | ':hover' | ':active'

const ROOT = /^(:root)+\s*/

/**
 * The declarations the document's rules give `element`, as written: a token stays `var(--name)`,
 * which is what a test of the token chosen asserts. happy-dom resolves no theme variables.
 */
export function declared(element: Element, pseudo?: Pseudo): Record<string, string> {
  const found: Record<string, string> = {}
  for (const sheet of document.styleSheets) {
    for (const rule of styleRules(sheet.cssRules)) {
      let selector = rule.selectorText.replace(ROOT, '')
      if (pseudo !== undefined) {
        if (!selector.endsWith(pseudo)) continue
        selector = selector.slice(0, -pseudo.length)
      }
      if (selector === '' || selector.includes(':') || !element.matches(selector)) continue
      Object.assign(found, declarations(rule.style))
    }
  }
  if (pseudo === undefined && element instanceof HTMLElement)
    Object.assign(found, declarations(element.style))
  return found
}

/** Every style rule, those inside a media query included, which is where tamagui puts `:hover`. */
function* styleRules(rules: Iterable<CSSRule>): Generator<CSSStyleRule> {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) yield rule
    else if (rule instanceof CSSGroupingRule) yield* styleRules(rule.cssRules)
  }
}

function declarations(style: CSSStyleDeclaration): Record<string, string> {
  const found: Record<string, string> = {}
  for (let at = 0; at < style.length; at += 1) {
    const property = style.item(at)
    found[property] = style.getPropertyValue(property)
  }
  return found
}
