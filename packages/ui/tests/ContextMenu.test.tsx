import { act } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { byId, nodeOf } from '@session/render-tier'
import { ELEMENT } from '@session/test-ids'

import { ContextMenu, ContextMenuLayer, elementMenuAnchor } from '#src/ContextMenu'
import type { ContextMenuEntry } from '#src/contextMenuEntries'
import type { MenuAnchor } from '#src/contextMenuPlacement'

import { renderInUI } from './support/render'

const IDS = ELEMENT.contextMenu
const ITEM = IDS.item

function entries(calls: { select: (id: string) => void }): ContextMenuEntry[] {
  const action = (id: string, label: string, extra: object = {}): ContextMenuEntry => ({
    id,
    kind: 'action',
    label,
    testID: ITEM(id),
    onSelect: () => {
      calls.select(id)
    },
    ...extra,
  })
  return [
    action('reply', 'Reply', { icon: 'reply' }),
    action('copy', 'Copy', { icon: 'copy' }),
    action('info', 'Info', { icon: 'info', disabled: true }),
    {
      id: 'more',
      kind: 'submenu',
      label: 'More',
      icon: 'settings',
      testID: ITEM('more'),
      entries: [action('inner', 'Inner'), action('other', 'Other')],
    },
    { id: 'line', kind: 'separator' },
    action('delete', 'Delete', { icon: 'trash', destructive: true }),
  ]
}

const AT_ELEMENT: MenuAnchor = { kind: 'element', rect: { x: 10, y: 10, width: 100, height: 40 } }
const AT_POINTER: MenuAnchor = { kind: 'point', x: 10, y: 10 }

function layer(anchor: MenuAnchor, inPlace = false) {
  const select = vi.fn<(id: string) => void>()
  const dismiss = vi.fn()
  const view = renderInUI(
    <ContextMenuLayer
      anchor={anchor}
      bounds={{ width: 1200, height: 800 }}
      entries={entries({ select })}
      inPlace={inPlace}
      onDismiss={dismiss}
      onSelect={(entry) => {
        if (entry.kind === 'action') entry.onSelect()
      }}
      accessibilityLabel="Message"
      backLabel="Back"
      testIDs={IDS}
    />,
  )
  return { select, dismiss, view }
}

const focused = () => document.activeElement?.getAttribute('data-testid')

describe('a context menu', () => {
  it('is a named menu of menu items, its disabled one and its submenu row said so', () => {
    layer(AT_POINTER)
    expect(nodeOf(IDS.menu)).toMatchObject({ role: 'menu', name: 'Message' })
    expect(nodeOf(ITEM('reply'))).toMatchObject({
      role: 'menuitem',
      name: 'Reply',
      disabled: false,
    })
    expect(nodeOf(ITEM('info'))).toMatchObject({ role: 'menuitem', name: 'Info', disabled: true })
    expect(byId(ITEM('more')).getAttribute('aria-haspopup')).toBe('menu')
    expect(byId(ITEM('more')).getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(1)
  })

  const tabStops = () =>
    [...document.querySelectorAll('[role="menuitem"]')]
      .filter((row) => row.getAttribute('tabindex') === '0')
      .map((row) => row.getAttribute('data-testid'))

  it('is one tab stop: the active row', async () => {
    const user = userEvent.setup()
    layer(AT_ELEMENT)
    expect(tabStops()).toEqual([ITEM('reply')])
    await user.keyboard('{ArrowDown}')
    expect(tabStops()).toEqual([ITEM('copy')])
  })

  it('marks its scroll view, so the scrollbar is inset by the rounded corners', () => {
    layer(AT_POINTER)
    expect(byId(IDS.menu).querySelectorAll('[data-rounded-scroll]')).toHaveLength(1)
  })

  it('keeps the first row a tab stop from a pointer, so a scrolling menu is reachable', () => {
    layer(AT_POINTER)
    expect(tabStops()).toEqual([ITEM('reply')])
  })

  it('focuses its first row when opened from the keyboard, and none from a pointer', () => {
    layer(AT_ELEMENT)
    expect(focused()).toBe(ITEM('reply'))
  })

  it('leaves the rows unfocused from a pointer until an arrow key', async () => {
    const user = userEvent.setup()
    layer(AT_POINTER)
    expect(focused()).toBe(IDS.menu)
    await user.keyboard('{ArrowDown}')
    expect(focused()).toBe(ITEM('reply'))
  })

  it('moves with the arrow keys, onto the disabled row, past the separator, round the end', async () => {
    const user = userEvent.setup()
    layer(AT_ELEMENT)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(focused()).toBe(ITEM('info'))
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(focused()).toBe(ITEM('delete'))
    await user.keyboard('{ArrowDown}')
    expect(focused()).toBe(ITEM('reply'))
    await user.keyboard('{ArrowUp}')
    expect(focused()).toBe(ITEM('delete'))
  })

  it('chooses with Enter and Space', async () => {
    const user = userEvent.setup()
    const { select } = layer(AT_ELEMENT)
    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowDown}[Space]')
    expect(select.mock.calls).toEqual([['reply'], ['copy']])
  })

  it('does nothing for a disabled row, by key or by click', async () => {
    const user = userEvent.setup()
    const { select, dismiss } = layer(AT_ELEMENT)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    await user.click(byId(ITEM('info')))
    expect(select).not.toHaveBeenCalled()
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('closes with Escape and leaves with Tab', async () => {
    const user = userEvent.setup()
    const { dismiss } = layer(AT_ELEMENT)
    await user.keyboard('{Escape}')
    await user.keyboard('{Tab}')
    expect(dismiss).toHaveBeenCalledTimes(2)
  })

  it('opens a submenu beside it with the arrow key, and closes only that with Escape', async () => {
    const user = userEvent.setup()
    const { dismiss } = layer(AT_ELEMENT)
    await user.keyboard('{End}{ArrowUp}{ArrowRight}')
    expect(byId(ITEM('more')).getAttribute('aria-expanded')).toBe('true')
    expect(nodeOf(IDS.submenu)).toMatchObject({ role: 'menu', name: 'More' })
    expect(focused()).toBe(ITEM('inner'))
    await user.keyboard('{ArrowDown}')
    expect(focused()).toBe(ITEM('other'))
    await user.keyboard('{Escape}')
    expect(nodeOf(IDS.submenu)).toBeNull()
    expect(focused()).toBe(ITEM('more'))
    expect(dismiss).not.toHaveBeenCalled()
    await user.keyboard('{ArrowRight}{ArrowLeft}')
    expect(focused()).toBe(ITEM('more'))
  })

  it('opens a submenu in place on a narrow window, with a way back', async () => {
    const user = userEvent.setup()
    const { select } = layer(AT_ELEMENT, true)
    await user.click(byId(ITEM('more')))
    expect(byId(IDS.back)).toBeDefined()
    expect(nodeOf(IDS.menu)).toMatchObject({ role: 'menu', name: 'More' })
    await user.click(byId(ITEM('inner')))
    expect(select).toHaveBeenCalledWith('inner')
    await user.click(byId(IDS.back))
    expect(byId(ITEM('reply'))).toBeDefined()
  })
})

describe('an open ContextMenu', () => {
  function Host({ select }: { select: (id: string) => void }) {
    const [anchor, setAnchor] = useState<MenuAnchor | null>(null)
    return (
      <>
        <button type="button" data-testid="opener" onClick={() => setAnchor(AT_ELEMENT)}>
          open
        </button>
        <ContextMenu
          anchor={anchor}
          entries={entries({ select })}
          onDismiss={() => {
            setAnchor(null)
          }}
          accessibilityLabel="Message"
          backLabel="Back"
          testIDs={IDS}
        />
      </>
    )
  }

  it('runs the chosen action once it has closed, and gives focus back', async () => {
    const user = userEvent.setup()
    const order: string[] = []
    renderInUI(
      <Host
        select={(id) => {
          order.push(`${id} with menu ${document.querySelector('[role="menu"]') ? 'open' : 'gone'}`)
        }}
      />,
    )
    const opener = byId('opener' as never)
    await user.click(opener)
    expect(focused()).toBe(ITEM('reply'))
    await user.keyboard('{Enter}')
    await act(async () => {})
    expect(order).toEqual(['reply with menu gone'])
    expect(document.activeElement).toBe(opener)
  })
})

describe('an element anchor', () => {
  it('is the element\u2019s rectangle, read at once', () => {
    const element = document.createElement('div')
    element.getBoundingClientRect = () => new DOMRect(10, 20, 300, 40)
    let anchor: MenuAnchor | null = null
    elementMenuAnchor(element, (measured) => {
      anchor = measured
    })
    expect(anchor).toEqual({ kind: 'element', rect: { x: 10, y: 20, width: 300, height: 40 } })
  })
})
