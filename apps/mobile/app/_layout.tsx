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
  const [store, setStore] = useState<SessionStore | null>(null)

  useEffect(() => {
    let live = true
    void storePromise.then((created) => {
      if (!live) return
      setStore(created)
      void created.actions.hydrate()
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
