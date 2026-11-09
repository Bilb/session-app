import type { IconName } from './Icon.types'

interface MenuEntryShared {
  /** Unique among its siblings: the key, and how an open submenu is remembered. */
  id: string
}

interface MenuRowShared {
  label: string
  /** Rows in one menu either all have one or none do, so their labels line up. */
  icon?: IconName | undefined
  /** Drawn and reachable by the arrow keys, so the menu keeps its order, but never activated. */
  disabled?: boolean | undefined
  testID: string
}

interface MenuActionVariant {
  kind: 'action'
  /** Called after the menu has closed, so what it opens is not stacked under the menu. */
  onSelect: () => void
  /** Tints the label and its icon, for an entry that destroys something. */
  destructive?: boolean | undefined
}

interface MenuSubmenuVariant {
  kind: 'submenu'
  entries: readonly ContextMenuEntry[]
}

interface MenuSeparatorVariant {
  kind: 'separator'
}

export type ContextMenuRow = MenuEntryShared &
  MenuRowShared &
  (MenuActionVariant | MenuSubmenuVariant)

export type ContextMenuEntry = ContextMenuRow | (MenuEntryShared & MenuSeparatorVariant)

export function isMenuRow(entry: ContextMenuEntry): entry is ContextMenuRow {
  return entry.kind !== 'separator'
}

/** The entries a path of open submenu ids leads to; the root's when the path is empty. */
export function entriesAt(
  root: readonly ContextMenuEntry[],
  path: readonly string[],
): readonly ContextMenuEntry[] {
  let entries = root
  for (const id of path) {
    const next = entries.find((entry) => entry.id === id)
    if (next?.kind !== 'submenu') return entries
    entries = next.entries
  }
  return entries
}

/**
 * The entries with every separator that would not sit between two rows dropped: none leading,
 * trailing or doubled. A caller builds its menu from conditional groups, so which separators are
 * needed is only known once the groups are.
 */
export function tidyMenu(entries: readonly ContextMenuEntry[]): ContextMenuEntry[] {
  const kept: ContextMenuEntry[] = []
  for (const [index, entry] of entries.entries()) {
    if (isMenuRow(entry)) kept.push(entry)
    else if (
      kept.length > 0 &&
      isMenuRow(kept[kept.length - 1] as ContextMenuEntry) &&
      entries.slice(index + 1).some(isMenuRow)
    )
      kept.push(entry)
  }
  return kept
}
