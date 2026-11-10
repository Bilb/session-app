import { describe, expect, it } from 'vitest'

import { entriesAt, tidyMenu, type ContextMenuEntry } from '#src/contextMenuEntries'

const row = (id: string): ContextMenuEntry => ({
  id,
  kind: 'action',
  label: id,
  testID: id,
  onSelect: () => {},
})
const line = (id: string): ContextMenuEntry => ({ id, kind: 'separator' })

describe('a menu built from conditional groups', () => {
  it('keeps only the separators that sit between two rows', () => {
    const tidied = tidyMenu([line('a'), row('x'), line('b'), line('c'), row('y'), line('d')])
    expect(tidied.map((entry) => entry.id)).toEqual(['x', 'b', 'y'])
  })

  it('leaves no separator when every group but one is empty', () => {
    expect(tidyMenu([line('a'), row('x'), line('b')]).map((entry) => entry.id)).toEqual(['x'])
  })
})

describe('a path of open submenus', () => {
  const tree: ContextMenuEntry[] = [
    row('x'),
    {
      id: 'more',
      kind: 'submenu',
      label: 'More',
      testID: 'more',
      entries: [{ id: 'deeper', kind: 'submenu', label: 'D', testID: 'd', entries: [row('z')] }],
    },
  ]

  it('leads to the entries it names', () => {
    expect(entriesAt(tree, []).map((entry) => entry.id)).toEqual(['x', 'more'])
    expect(entriesAt(tree, ['more', 'deeper']).map((entry) => entry.id)).toEqual(['z'])
  })
})
