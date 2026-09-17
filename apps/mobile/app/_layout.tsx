import { useLocale, useTextDirection } from '@session/screens'
import { SessionStoreProvider, type SessionStore } from '@session/state'
import { DirectionRoot, Text, UIProvider, YStack } from '@session/ui'
import { Slot } from 'expo-router'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { mobileBackdropBlur } from '../src/backdrop'
import { MobileCameraProvider } from '../src/camera'
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
  const locale = useLocale()
  // And which way that language reads, which `DirectionRoot` below mirrors the tree to.
  const rtl = useTextDirection()

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
    // The keyboard's own animation progress, read once for the whole tree. Every avoiding view
    // below here is driven from it, which is what lets them move on the keyboard's curve rather
    // than on one of their own.
    <KeyboardProvider>
      <SafeAreaProvider>
        <UIProvider backdropBlur={mobileBackdropBlur}>
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
                <MobileCameraProvider>
                  <DirectionRoot rtl={rtl}>
                    {/* **Keyed on the language, because `tr()` is a module-scope read.** Nothing
                        below re-renders when it changes unless something above does -- and the
                        router holds the routed screen's element itself, so a re-render here does
                        not reach it the way it does on the desktop tree, where the root renders
                        the screens. The key makes the change of language a change of element,
                        which is what it has to be for the strings to follow. */}
                    <Slot key={locale} />
                  </DirectionRoot>
                </MobileCameraProvider>
              </MobileNavProvider>
            </SessionStoreProvider>
          )}
        </UIProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  )
}
