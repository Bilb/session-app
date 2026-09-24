import type { ReactNode } from 'react'
import { FONT_SIZE } from '@session/theme-tokens'
import { Platform, StyleSheet } from 'react-native'
import { ScreenStack, ScreenStackHeaderLeftView, ScreenStackItem } from 'react-native-screens'
import { ScrollView, XStack, YStack } from 'tamagui'

import { BarButton } from './BarButton'
import { Icon } from './Icon'
import { ACTION_HEIGHT } from './modalPanelMetrics'
import { PressArea } from './PressArea'
import { useScreenInsets } from './screenInsets'
import { Text } from './Text'
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
  // The modal runs to the bottom of the screen, under the home indicator. Whatever sits last -- the
  // end of the scroll, or a screen's footer -- is held clear of it.
  const bottom = useScreenInsets().bottom

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
            // 26 bold, as both phone clients draw a settings title -- on the first screen and on a
            // pushed one alike. The system's own is 17, which read as a different, lesser screen.
            titleFontSize: FONT_SIZE.headingLarge,
            titleFontWeight: '700',
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
                  {BAR_DRAWS_BUTTON ? (
                    // A bare glyph, as the system's own back button is: the bar draws the glass
                    // button around it, and a pressed state of ours on top reads as two buttons.
                    <PressArea
                      accessibilityLabel={closeLabel}
                      onPress={onClose}
                      {...(closeTestID === undefined ? {} : { testID: closeTestID })}
                    >
                      {() => <Icon name="x" size="lg" color="$textPrimary" />}
                    </PressArea>
                  ) : (
                    // Where the bar draws nothing, the desktop's close: a circle that fills while
                    // it is held, so the glyph is not the whole control.
                    <XStack alignItems="center" gap={TITLE_AFTER_CLOSE}>
                      <BarButton
                        icon="x"
                        accessibilityLabel={closeLabel}
                        onPress={onClose}
                        testID={closeTestID}
                      />
                      {/* Android's bar drops its title once there is a leading item, so the title
                          is drawn here, where a pushed screen's sits after its back arrow. */}
                      {Platform.OS === 'android' ? (
                        <Text size="$headingLarge" weight="bold" numberOfLines={1}>
                          {screen.title}
                        </Text>
                      ) : null}
                    </XStack>
                  )}
                </ScreenStackHeaderLeftView>
              ) : undefined,
          }}
        >
          <ScrollView
            flex={1}
            {...(screen.footer === undefined
              ? { contentContainerStyle: { paddingBottom: bottom } }
              : {})}
          >
            {screen.render()}
          </ScrollView>
          {screen.footer === undefined ? null : (
            <YStack paddingBottom={bottom}>
              <XStack alignItems="stretch" height={ACTION_HEIGHT}>
                {screen.footer()}
              </XStack>
            </YStack>
          )}
        </ScreenStackItem>
      ))}
    </ScreenStack>
  )
}

/**
 * Whether the bar draws its own button around a leading item. iOS 26's bars put a glass button
 * behind it, which answers a press itself; earlier iOS and Android draw nothing.
 */
const BAR_DRAWS_BUTTON =
  Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26

/**
 * The room between the close and the title on Android, so the title starts where the bar puts a
 * pushed screen's after its back arrow -- measured against Help's, rather than a rung of the scale.
 */
const TITLE_AFTER_CLOSE = 19

const styles = StyleSheet.create({ fill: { flex: 1 } })
