import {
  AdaptiveShell,
  ConversationListScreen,
  ConversationScreen,
  NewConversationScreen,
  OnboardingFlow,
  StartingScreen,
  RequestsScreen,
  SettingsScreen,
  useLocale,
} from '@session/screens'
import { SessionStoreProvider, useAccount, useHydrated } from '@session/state'
import { Text, UIProvider, YStack } from '@session/ui'
import { useEffect, useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router'

import { DesktopNavProvider } from './nav'
import { store } from './store'

/**
 * The desktop app.
 *
 * The route table here is one of the three declarations the route-contract test holds
 * together - it scrapes the path of every Route element below, so those strings are load-bearing.
 */
export function App() {
  // Subscribes the whole tree to the app's language. `tr()` reads a module-scope variable, so
  // nothing below re-renders when that changes unless something above it does -- and it has to be
  // here rather than in a provider, because a provider's `children` arrive as an element created
  // by its own parent, and React skips a subtree whose element has not changed.
  useLocale()

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
  const account = useAccount()
  const location = useLocation()
  const [onboarding, setOnboarding] = useState(false)

  if (!hydrated) return <StartingScreen />

  // Onboarding takes the whole window rather than a pane: there is no list to sit beside it,
  // and there will not be one until it has minted an identity.
  // `|| onboarding` because an account appearing is not the same as onboarding being over: a
  // restore mints one the moment the phrase is accepted and still has a wait to sit through.
  if (account?.haveAccount !== true || onboarding)
    return <OnboardingFlow onRunningChange={setOnboarding} />

  return (
    <AdaptiveShell
      list={<ConversationListScreen />}
      detail={
        <Routes>
          <Route path="" element={null} />
          <Route path="c/:id" element={<ConversationRoute />} />
          <Route path="new" element={<NewConversationScreen />} />
          <Route path="requests" element={<RequestsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="onboarding" element={<OnboardingFlow />} />
        </Routes>
      }
      // Any route but the list has something to show in the detail pane, not just a
      // conversation: requests and settings are detail routes too, and keying this on the
      // conversation alone left them rendering the placeholder instead of the screen.
      hasDetail={location.pathname !== '/'}
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
