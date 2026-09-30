import { useEffect } from 'react'
import { BackHandler, Platform, StyleSheet } from 'react-native'
import { ScreenStack, ScreenStackItem } from 'react-native-screens'
import { useMedia } from 'tamagui'

import { ModalStackHost } from './ModalStackHost'
import type { ModalStackRootProps } from './ModalStackRoot.types'
import { useModalEntries, useModals } from './ModalsProvider'
import { PhoneModalStack } from './PhoneModalStack'

export type { ModalStackRootProps }

/**
 * The app with its modals, presented on a phone the way the platform presents a modal.
 *
 * **A phone's settings panel is a native full-screen modal**, holding its own navigation stack:
 * what the iOS client does with settings. It slides up and back down with the system's own
 * animation, and its screens are the platform's pushes. Drawn inside react-native's `Modal`
 * instead, the stack's screens receive no taps -- the native stack moves them out of the touch
 * handling a `Modal` gives its content -- while scrolling, being native, still works.
 *
 * So the app sits in the root screen of a native stack, always, and each phone panel is presented
 * above it. **Always**, not only on a phone: a tablet turning, or a window crossing the breakpoint,
 * must not move the app to a different place in the tree, which would remount all of it.
 *
 * An alert goes through `ModalStackHost`, in the topmost native modal if there is one -- iOS can
 * only present from a screen that is not already presenting -- and from the app otherwise. On a
 * tablet everything goes through the host, as on the desktop.
 */
export function ModalStackRoot({ children, ...host }: ModalStackRootProps) {
  const entries = useModalEntries()
  const modals = useModals()
  const phone = !useMedia().gtSm

  const panels = phone ? entries.filter((entry) => entry.kind === 'panel') : []
  const lastPanel = panels.at(-1)
  const drawnByHost =
    lastPanel === undefined
      ? phone
        ? entries.filter((entry) => entry.kind === 'alert')
        : entries
      : entries.slice(entries.indexOf(lastPanel) + 1)

  // Android's back button, which a native stack presented this way does not answer by itself. One
  // level, as everywhere: a pushed screen, otherwise the modal.
  useEffect(() => {
    if (panels.length === 0) return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      modals.back()
      return true
    })
    return () => {
      subscription.remove()
    }
  }, [panels.length, modals])

  return (
    <ScreenStack style={styles.fill}>
      <ScreenStackItem screenId="app" headerConfig={{ hidden: true }} contentStyle={styles.fill}>
        {children}
        {lastPanel === undefined ? <ModalStackHost {...host} entries={drawnByHost} /> : null}
      </ScreenStackItem>
      {panels.map((entry) => (
        <ScreenStackItem
          key={entry.id}
          screenId={entry.id}
          stackPresentation="fullScreenModal"
          // Each phone's own entrance: iOS covers from the bottom, and Android fades up from a little
          // below, as the legacy client's settings activity opens, rather than pushing across.
          stackAnimation={Platform.OS === 'android' ? 'fade_from_bottom' : 'default'}
          headerConfig={{ hidden: true }}
          contentStyle={styles.fill}
          // The platform took it away itself -- nothing does on a full-screen modal today, but
          // the stack has to follow if it ever does.
          onDismissed={() => {
            modals.dismiss(entry.id)
          }}
        >
          <PhoneModalStack
            screens={entry.stack}
            closeLabel={host.closeLabel}
            onClose={
              entry.dismissible
                ? () => {
                    modals.dismiss(entry.id)
                  }
                : undefined
            }
            onPop={(count) => {
              for (let popped = 0; popped < count; popped += 1) modals.pop()
            }}
            closeTestID={host.closeTestID}
          />
          {entry === lastPanel ? <ModalStackHost {...host} entries={drawnByHost} /> : null}
        </ScreenStackItem>
      ))}
    </ScreenStack>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
