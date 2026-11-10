import { isMenuRow, type ContextMenuEntry } from './contextMenuEntries'

/** What a key does inside one open menu level. */
export type MenuKeyAction =
  | { kind: 'move'; index: number }
  | { kind: 'activate'; index: number }
  | { kind: 'openSubmenu'; index: number }
  /** Back to the parent level, focus on the row that opened this one. */
  | { kind: 'closeLevel' }
  /** The whole menu, every level. */
  | { kind: 'dismiss' }

export interface MenuKeyContext {
  entries: readonly ContextMenuEntry[]
  /** The focused row's index in `entries`, or -1 when none is (opened by a pointer). */
  active: number
  /** Whether this level is a submenu, so the key back toward the parent closes it. */
  nested: boolean
  rtl: boolean
}

function rowIndices(entries: readonly ContextMenuEntry[]): number[] {
  return entries.flatMap((entry, index) => (isMenuRow(entry) ? [index] : []))
}

/**
 * The next row from `active` in `step` direction, wrapping, separators skipped. Disabled rows
 * are stops: WAI-ARIA's menu pattern keeps them focusable so the menu reads whole.
 */
function stepFrom(entries: readonly ContextMenuEntry[], active: number, step: 1 | -1): number {
  const rows = rowIndices(entries)
  if (rows.length === 0) return -1
  const at = rows.indexOf(active)
  if (at === -1) return step === 1 ? rows[0]! : rows[rows.length - 1]!
  return rows[(at + step + rows.length) % rows.length]!
}

/** The next row after `active` whose label starts with `char`, wrapping; -1 when none does. */
function typeahead(entries: readonly ContextMenuEntry[], active: number, char: string): number {
  const wanted = char.toLocaleLowerCase()
  const rows = rowIndices(entries)
  const start = Math.max(0, rows.indexOf(active) + 1)
  for (let offset = 0; offset < rows.length; offset++) {
    const index = rows[(start + offset) % rows.length]!
    const entry = entries[index]!
    if (isMenuRow(entry) && entry.label.trimStart().toLocaleLowerCase().startsWith(wanted))
      return index
  }
  return -1
}

/**
 * The WAI-ARIA menu pattern's keys, decided apart from any element so every rule is a unit test.
 * Null for a key the menu leaves alone.
 *
 * The key into a submenu points at the trailing edge, so it is ArrowLeft in a right-to-left
 * layout; the key back out mirrors with it.
 */
export function menuKeyAction(key: string, context: MenuKeyContext): MenuKeyAction | null {
  const { entries, active, nested, rtl } = context
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const backward = rtl ? 'ArrowRight' : 'ArrowLeft'
  const current = active >= 0 ? entries[active] : undefined
  const row = current !== undefined && isMenuRow(current) ? current : undefined

  switch (key) {
    case 'ArrowDown':
      return { kind: 'move', index: stepFrom(entries, active, 1) }
    case 'ArrowUp':
      return { kind: 'move', index: stepFrom(entries, active, -1) }
    case 'Home':
      return { kind: 'move', index: stepFrom(entries, -1, 1) }
    case 'End':
      return { kind: 'move', index: stepFrom(entries, -1, -1) }
    case 'Escape':
      return nested ? { kind: 'closeLevel' } : { kind: 'dismiss' }
    case 'Tab':
      return { kind: 'dismiss' }
    case forward:
      return row?.kind === 'submenu' && row.disabled !== true
        ? { kind: 'openSubmenu', index: active }
        : null
    case backward:
      return nested ? { kind: 'closeLevel' } : null
    case 'Enter':
    case ' ':
      if (row === undefined || row.disabled === true) return null
      return row.kind === 'submenu'
        ? { kind: 'openSubmenu', index: active }
        : { kind: 'activate', index: active }
    default: {
      // One printable character, whatever script it is in: a two-character key name is a named key.
      if ([...key].length !== 1 || key === ' ') return null
      const index = typeahead(entries, active, key)
      return index === -1 ? null : { kind: 'move', index }
    }
  }
}
