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
 * The app with its modals; on a phone each panel is a native full-screen modal holding its own
 * native stack. Inside react-native's `Modal` a
 * react-native-screens stack receives no taps, so panels cannot go through `ModalStackHost`.
 *
 * The app is always the root screen of a native stack, even on a tablet: crossing the breakpoint
 * must not move it in the tree, which would remount all of it.
 *
 * Alerts go through `ModalStackHost` inside the topmost native modal (iOS cannot present from a
 * screen that is already presenting), or over the app when none is open. On a tablet everything
 * goes through the host.
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

  // A native stack presented this way does not answer Android's back button by itself.
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
          // Android fades up from below, as an Android activity opens.
          stackAnimation={Platform.OS === 'android' ? 'fade_from_bottom' : 'default'}
          headerConfig={{ hidden: true }}
          contentStyle={styles.fill}
          // If the platform ever dismisses it itself, the stack has to follow.
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
