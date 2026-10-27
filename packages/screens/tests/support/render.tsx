import { cleanup, render, type RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach } from 'vitest'

import { SessionStoreProvider, type SessionStore } from '@session/state'
import { ModalStackProvider, ToastProvider, UIProvider } from '@session/ui'

import { ConversationUiContext, type ConversationUi } from '#src/conversationUi'

// testing-library unmounts by itself only where vitest's globals are on, which they are not here.
afterEach(() => {
  cleanup()
})

function Providers({
  store,
  ui,
  children,
}: {
  store?: SessionStore | undefined
  ui?: ConversationUi | undefined
  children: ReactNode
}) {
  const drawn = (
    <UIProvider>
      <ModalStackProvider>
        <ToastProvider>
          {ui === undefined ? (
            children
          ) : (
            <ConversationUiContext.Provider value={ui}>{children}</ConversationUiContext.Provider>
          )}
        </ToastProvider>
      </ModalStackProvider>
    </UIProvider>
  )
  return store === undefined ? (
    drawn
  ) : (
    <SessionStoreProvider store={store}>{drawn}</SessionStoreProvider>
  )
}

/**
 * Drawn inside what the desktop renderer wraps a screen in: the store, the UI configuration, the
 * modal stack and the toasts, and a conversation's context where a message row needs one.
 */
export function renderScreen(
  node: ReactNode,
  { store, ui }: { store?: SessionStore | undefined; ui?: ConversationUi | undefined } = {},
): RenderResult {
  const result = render(
    <Providers store={store} ui={ui}>
      {node}
    </Providers>,
  )
  return {
    ...result,
    rerender: (next: ReactNode) => {
      result.rerender(
        <Providers store={store} ui={ui}>
          {next}
        </Providers>,
      )
    },
  }
}
