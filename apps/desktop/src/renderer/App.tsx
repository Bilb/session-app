import { conversationFromPath } from '@session/app'
import { AdaptiveShell, ConversationListScreen, ConversationScreen } from '@session/screens'
import { SessionStoreProvider, useHydrated } from '@session/state'
import { Text, UIProvider, YStack } from '@session/ui'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router'

import { DesktopNavProvider } from './nav'
import { store } from './store'

/**
 * The desktop app.
 *
 * The route table here is one of the three declarations the route-contract test holds
 * together — it scrapes this file for `path="..."`, so the strings below are load-bearing.
 */
export function App() {
  useEffect(() => {
    void store.actions.hydrate()
    return () => store.actions.dispose()
  }, [])

  return (
    <UIProvider>
      <SessionStoreProvider store={store}>
        <MemoryRouter>
          <DesktopNavProvider>
            <Shell />
          </DesktopNavProvider>
        </MemoryRouter>
      </SessionStoreProvider>
    </UIProvider>
  )
}

function Shell() {
  const hydrated = useHydrated()
  const location = useLocation()
  const openConversation = conversationFromPath(location.pathname)

  if (!hydrated) {
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$backgroundPrimary"
      >
        <Text tone="secondary">Starting…</Text>
      </YStack>
    )
  }

  return (
    <AdaptiveShell
      list={<ConversationListScreen />}
      detail={
        <Routes>
          <Route path="" element={null} />
          <Route path="c/:id" element={<ConversationRoute />} />
          <Route path="requests" element={<Placeholder label="Message requests" />} />
          <Route path="settings" element={<Placeholder label="Settings" />} />
          <Route path="onboarding" element={<Placeholder label="Welcome" />} />
        </Routes>
      }
      hasDetail={openConversation !== null}
      placeholder={<Placeholder label="Choose a conversation" />}
    />
  )
}

/**
 * Reading the id off the route is this file's job, so the screen itself never has to know
 * which router it is running under.
 */
function ConversationRoute() {
  const { id } = useParams<{ id: string }>()
  if (id === undefined) return null
  return <ConversationScreen conversationId={decodeURIComponent(id)} />
}

function Placeholder({ label }: { label: string }) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center">
      <Text tone="secondary">{label}</Text>
    </YStack>
  )
}
