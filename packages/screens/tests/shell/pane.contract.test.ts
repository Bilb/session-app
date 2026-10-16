import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DETAIL_PANE, LIST_PANE, SOLE_PANE } from '#src/shell/panes'

/**
 * Back is shown only where it is the way back.
 *
 * Beside the list the chevron only emptied the detail pane; in one pane it is the only way out,
 * including in a window narrowed with a conversation open, which stays on the conversation.
 */
describe('which panes show a way back', () => {
  it('hides it beside the list and shows it in one pane', () => {
    expect(DETAIL_PANE.besideList).toBe(true)
    expect(SOLE_PANE.besideList).toBe(false)
    expect(LIST_PANE.besideList).toBe(false)
  })

  it('keeps the window controls clear only for a pane at the leading edge', () => {
    expect(SOLE_PANE.atLeadingEdge).toBe(true)
    expect(LIST_PANE.atLeadingEdge).toBe(true)
    expect(DETAIL_PANE.atLeadingEdge).toBe(false)
  })

  it('is told by the shell which pane each screen is in', () => {
    // Read rather than rendered: the shell's two layouts are chosen by a media query, and what
    // matters here is only that each one wraps its panes, which the source says outright.
    const shell = readFileSync(
      join(import.meta.dirname, '../../src/shell/AdaptiveShell.tsx'),
      'utf8',
    )
    expect(shell).toContain('<PaneProvider value={LIST_PANE}>{list}</PaneProvider>')
    expect(shell).toContain('<PaneProvider value={DETAIL_PANE}>')
    expect(shell).toContain('<PaneProvider value={SOLE_PANE}>')
  })
})
