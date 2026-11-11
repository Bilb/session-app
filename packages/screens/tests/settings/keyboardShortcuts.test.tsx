import { memoryPorts, resetPorts, setPorts, type KeyboardShortcutsPort } from '@session/app'
import { friends } from '@session/client/fake'
import { createSessionStore, type SessionStore } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { useModalEntries, useModals } from '@session/ui'
import { act, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { HelpPage } from '#src/settings/HelpPage'
import { useKeyboardShortcutsCommand } from '#src/settings/useKeyboardShortcutsCommand'

import { renderScreen } from '../support/render'

/** Installs desktop's port, and hands back the menu command main would send. */
function withShortcuts(): () => void {
  let open: (() => void) | null = null
  const keyboardShortcuts: KeyboardShortcutsPort = {
    keyNames: 'pc',
    onOpenList: (handler) => {
      open = handler
      return () => {
        open = null
      }
    },
  }
  const ports = memoryPorts()
  setPorts({ ...ports, window: { ...ports.window, keyboardShortcuts } })
  return () => {
    act(() => {
      open?.()
    })
  }
}

/** Help reads the store for its log export. */
function store(): SessionStore {
  const client = friends(['Alice', 'Bob']).clients['Alice']
  if (client === undefined) throw new Error('fixture did not produce a client')
  return createSessionStore(client)
}

/** The titles of the open modals' top screens, frontmost last, and a way to close the first. */
let titles: string[] = []
let dismissFirst: () => void = () => undefined
let presentHelp: () => void = () => undefined

function Probe() {
  const entries = useModalEntries()
  const modals = useModals()
  titles = entries.map((modal) => modal.stack.at(-1)?.title ?? '')
  dismissFirst = () => {
    const first = entries[0]
    if (first !== undefined) modals.dismiss(first.id)
  }
  presentHelp = () => {
    modals.present({ initial: { title: 'Help', render: () => null } })
  }
  return null
}

function Command() {
  useKeyboardShortcutsCommand()
  return <Probe />
}

afterEach(() => {
  resetPorts()
  titles = []
})

describe('the keyboard shortcuts', () => {
  it('are not offered in Help where the app handles no keys', () => {
    setPorts(memoryPorts())
    renderScreen(<HelpPage />, { store: store() })
    expect(screen.queryByTestId(ELEMENT.help.keyboardShortcuts)).toBeNull()
  })

  it('open from Help where it does', async () => {
    withShortcuts()
    renderScreen(
      <>
        <HelpPage />
        <Probe />
      </>,
      { store: store() },
    )
    // Help is a screen of the settings modal, which the page is pushed onto.
    act(() => {
      presentHelp()
    })
    const row = screen.getByTestId(ELEMENT.help.keyboardShortcuts)
    expect(row.textContent).toContain('Keyboard Shortcuts')
    await userEvent.click(row)
    expect(titles).toEqual(['Keyboard Shortcuts'])
  })

  it('open on the menu command and close on the next', () => {
    const command = withShortcuts()
    renderScreen(<Command />)
    command()
    expect(titles).toEqual(['Keyboard Shortcuts'])
    command()
    expect(titles).toEqual([])
  })

  it('open again on the command after being closed some other way', () => {
    const command = withShortcuts()
    renderScreen(<Command />)
    command()
    act(() => {
      dismissFirst()
    })
    expect(titles).toEqual([])
    command()
    expect(titles).toEqual(['Keyboard Shortcuts'])
  })
})
