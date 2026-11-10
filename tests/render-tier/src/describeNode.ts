import {
  computeAccessibleDescription,
  computeAccessibleName,
  getRole,
  isInaccessible,
} from 'dom-accessibility-api'

import type { ExpectedNode, ExpectedRole } from '@session/expectations'

/** Everything an `ExpectedNode` can assert, read off one rendered element. */
export type DomNode = Required<ExpectedNode>

const ROLES: Partial<Record<string, ExpectedRole>> = {
  button: 'button',
  img: 'image',
  image: 'image',
  link: 'link',
  textbox: 'textbox',
  progressbar: 'progressbar',
  menu: 'menu',
  menuitem: 'menuitem',
}

function focusable(element: Element): boolean {
  const tabIndex = element.getAttribute('tabindex')
  if (tabIndex !== null) return Number(tabIndex) >= 0
  return element.matches('button:not([disabled]), a[href], input:not([disabled]), textarea')
}

/**
 * The element as a screen reader reaches it, or null where the tree hides it. The web has no role
 * for text, so an element with none is `text` where it says something and `none` where it does not.
 */
export function describeNode(element: Element | null): DomNode | null {
  if (element === null || isInaccessible(element)) return null
  const role = ROLES[getRole(element) ?? '']
  const label = element.getAttribute('aria-label')
  const text = label ?? element.textContent
  const ownText = [...element.childNodes].some(
    (child) => child.nodeType === child.TEXT_NODE && (child.textContent ?? '').trim() !== '',
  )
  const generic: ExpectedRole = label !== null || ownText ? 'text' : 'none'
  const name =
    role === undefined ? (generic === 'text' ? text : null) : computeAccessibleName(element)
  return {
    role: role ?? generic,
    name: name === '' ? null : name,
    hint:
      element.getAttribute('aria-description') ?? (computeAccessibleDescription(element) || null),
    disabled: element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('disabled'),
    busy: element.getAttribute('aria-busy') === 'true',
    focusable: focusable(element),
  }
}
