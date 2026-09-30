import type { EditFlags } from 'electron'
import { describe, expect, it } from 'vitest'

import { editMenuItems } from '#src/main/editMenu'

const everything: EditFlags = {
  canUndo: true,
  canRedo: true,
  canCut: true,
  canCopy: true,
  canPaste: true,
  canDelete: true,
  canSelectAll: true,
  canEditRichly: false,
}

describe('the right-click menu', () => {
  it('offers the edit commands in a field, in the usual order', () => {
    const items = editMenuItems({ isEditable: true, selectionText: '', editFlags: everything })
    expect(items.map((item) => item.role ?? item.type)).toEqual([
      'undo',
      'redo',
      'separator',
      'cut',
      'copy',
      'paste',
      'separator',
      'selectAll',
    ])
    expect(items.find((item) => item.role === 'paste')?.label).toBe('Paste')
  })

  it('greys out what the field cannot do rather than hiding it', () => {
    const items = editMenuItems({
      isEditable: true,
      selectionText: '',
      editFlags: { ...everything, canCut: false, canCopy: false },
    })
    expect(items.find((item) => item.role === 'cut')?.enabled).toBe(false)
    expect(items.find((item) => item.role === 'copy')?.enabled).toBe(false)
    expect(items.find((item) => item.role === 'paste')?.enabled).toBe(true)
  })

  it('offers only Copy on selected text outside a field', () => {
    const items = editMenuItems({
      isEditable: false,
      selectionText: 'hello',
      editFlags: everything,
    })
    expect(items.map((item) => item.role)).toEqual(['copy'])
  })

  it('draws nothing where there is nothing to act on', () => {
    expect(
      editMenuItems({ isEditable: false, selectionText: '  ', editFlags: everything }),
    ).toEqual([])
  })
})
