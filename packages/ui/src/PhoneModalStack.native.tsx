import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import { ScreenStack, ScreenStackHeaderLeftView, ScreenStackItem } from 'react-native-screens'
import { ScrollView, XStack } from 'tamagui'

import { Icon } from './Icon'
import { ACTION_HEIGHT } from './modalPanelMetrics'
import { PressArea } from './PressArea'
import { useTokenColor } from './useTokenColor'

/** One screen of the modal, as the phone's stack draws it. */
interface PhoneModalScreen {
  key: string
  title: string
  render: () => ReactNode
  footer?: (() => ReactNode) | undefined
}

export interface PhoneModalStackProps {
  /** Oldest first: the first is the modal's own screen, the rest were pushed onto it. */
  screens: readonly PhoneModalScreen[]
  /** Names the close control on the first screen. */
  closeLabel: string
  /** Closes the modal from its first screen, or undefined where it cannot be left that way. */
  onClose?: (() => void) | undefined
  /** The platform took screens off -- a back swipe, the back button -- and the stack must follow. */
  onPop: (count: number) => void
  closeTestID?: string | undefined
}

/**
 * A modal's screens on a phone, on the platform's own navigation stack.
 *
 * What the iOS client does with settings: a full-screen modal holding a navigation controller, so a
 * pushed screen arrives with the system's push, its title and back button in the system's bar, and
 * the back swipe. Android gets its own native stack and bar the same way. The close is the bar's
 * leading item on the first screen; a pushed screen has back there instead.
 *
 * The stack still decides what is on it. A swipe or the back button that takes screens off is
 * reported through `onPop`, and the stack follows, as it follows any other move.
 */
export function PhoneModalStack({
  screens,
  closeLabel,
  onClose,
  onPop,
  closeTestID,
}: PhoneModalStackProps) {
  const background = useTokenColor('$backgroundPrimary')
  const text = useTokenColor('$textPrimary')

  return (
    <ScreenStack style={styles.fill}>
      {screens.map((screen, at) => (
        <ScreenStackItem
          key={screen.key}
          screenId={screen.key}
          gestureEnabled={at > 0}
          onDismissed={(event) => {
            onPop(event.nativeEvent.dismissCount)
          }}
          contentStyle={[styles.fill, { backgroundColor: background }]}
          headerConfig={{
            title: screen.title,
            backgroundColor: background,
            color: text,
            titleColor: text,
            hideShadow: true,
            backTitleVisible: false,
            // One step at a time: the long-press menu would take several screens off at once.
            disableBackButtonMenu: true,
            children:
              at === 0 && onClose !== undefined ? (
                <ScreenStackHeaderLeftView>
                  {/* A bare glyph, as the system's own back button is: the bar draws the button
                      around it, and a pressed state of ours on top of that reads as two buttons. */}
                  <PressArea
                    accessibilityLabel={closeLabel}
                    onPress={onClose}
                    {...(closeTestID === undefined ? {} : { testID: closeTestID })}
                  >
                    {() => <Icon name="x" size="lg" color="$textPrimary" />}
                  </PressArea>
                </ScreenStackHeaderLeftView>
              ) : undefined,
          }}
        >
          <ScrollView flex={1}>{screen.render()}</ScrollView>
          {screen.footer === undefined ? null : (
            <XStack alignItems="stretch" height={ACTION_HEIGHT}>
              {screen.footer()}
            </XStack>
          )}
        </ScreenStackItem>
      ))}
    </ScreenStack>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
