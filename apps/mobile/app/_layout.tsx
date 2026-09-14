import { useLocale } from '@session/screens'
import { SessionStoreProvider, type SessionStore } from '@session/state'
import { Text, UIProvider, YStack } from '@session/ui'
import { Slot } from 'expo-router'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { MobileNavProvider } from '../src/nav'
import { storePromise } from '../src/store'

/**
 * The app shell.
 *
 * The store is created asynchronously because opening the bridge is, so this waits for it
 * before rendering anything that would read from it.
 */
export default function RootLayout() {
  // Subscribes the whole tree to the app's language -- see the note on the desktop root. It has to
  // be the component that creates the subtree, not a provider wrapped around one.
  useLocale()

  const [store, setStore] = useState<SessionStore | null>(null)

  useEffect(() => {
    let live = true
    void storePromise.then((created) => {
      if (!live) return
      setStore(created)
      // `start`, not `hydrate`: a rejection here has no screen to land on, so the store turns it
      // into state instead. See the action.
      void created.actions.start()
    })
    return () => {
      live = false
    }
  }, [])

  return (
    <SafeAreaProvider>
      <UIProvider>
        {store === null ? (
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            backgroundColor="$backgroundPrimary"
          >
            <Text tone="secondary">Starting…</Text>
          </YStack>
        ) : (
          <SessionStoreProvider store={store}>
            <MobileNavProvider>
              <Slot />
            </MobileNavProvider>
          </SessionStoreProvider>
        )}
      </UIProvider>
    </SafeAreaProvider>
  )
}
