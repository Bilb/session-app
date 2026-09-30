import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron'

import { tr } from '@session/localization'

/**
 * The right-click menu: Electron draws none of its own.
 *
 * Every item is a built-in role, so it runs the browser's own editing command on the focused
 * field. Paste reaches the clipboard that way without the page, or a permission, being involved.
 */
export function editMenuItems(
  params: Pick<ContextMenuParams, 'isEditable' | 'selectionText' | 'editFlags'>,
): MenuItemConstructorOptions[] {
  const { editFlags: can } = params
  if (params.isEditable) {
    return [
      { role: 'undo', label: tr('undo'), enabled: can.canUndo },
      { role: 'redo', label: tr('redo'), enabled: can.canRedo },
      { type: 'separator' },
      { role: 'cut', label: tr('cut'), enabled: can.canCut },
      { role: 'copy', label: tr('copy'), enabled: can.canCopy },
      { role: 'paste', label: tr('paste'), enabled: can.canPaste },
      { type: 'separator' },
      { role: 'selectAll', label: tr('selectAll'), enabled: can.canSelectAll },
    ]
  }
  if (params.selectionText.trim() !== '') return [{ role: 'copy', label: tr('copy') }]
  return []
}
