import { useEffect, useRef, useState } from 'react'
import { Keyboard, Modal, useWindowDimensions } from 'react-native'
import type { KeyboardEvent } from 'react-native'
import { XStack, YStack, type TamaguiElement } from 'tamagui'

import { measureAnchor, panelLeft, panelPlacement, type AnchorRect } from './anchorRect'
import { Button } from './Button'
import { Icon } from './Icon'
import { LanguageChoiceList } from './LanguageChoiceList'
import { Text } from './Text'
import { useScreenInsets } from './screenInsets'
import type { LanguagePickerProps } from './LanguagePicker.types'

/** Wide enough for the longest language name, narrow enough for a phone. */
const PANEL_WIDTH = 320
/** The smallest gap worth keeping between the panel and the window's edge. */
const MARGIN = 12
/** Clear of the trigger, close enough to read as hanging from it. */
const GAP = 6
/** Below this the panel is not worth opening downwards, and it flips above the trigger instead. */
const MIN_PANEL_HEIGHT = 260

/**
 * How much of the window the keyboard is currently covering.
 *
 * react-native's own `Keyboard` rather than the keyboard-controller this package uses elsewhere,
 * because this file is one of the few here with no `.native` pair -- the controller is a native
 * module and would not resolve in the desktop bundle. `Keyboard` is a no-op on the web, which is
 * the right answer there: a desktop window has no keyboard drawn over it.
 *
 * Both event pairs are listened for because neither platform sends both: iOS has the `Will`
 * events, which arrive with the animation, and Android only has the `Did` ones.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const shown = (event: KeyboardEvent) => {
      setHeight(event.endCoordinates.height)
    }
    const hidden = () => {
      setHeight(0)
    }
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', shown),
      Keyboard.addListener('keyboardDidShow', shown),
      Keyboard.addListener('keyboardWillHide', hidden),
      Keyboard.addListener('keyboardDidHide', hidden),
    ]
    return () => {
      for (const subscription of subscriptions) subscription.remove()
    }
  }, [])
  return height
}

/**
 * The control that changes the app's language: a flag, a chevron, and a panel under it.
 *
 * **One file rather than a web/native pair**, which is the exception to how this package usually
 * splits. The app owns the language on every platform -- the OS's own per-app screen is not used,
 * because it reaches nothing the picker cannot and does not reach the system prompts at all -- so
 * there is no platform difference here to split on.
 *
 * Drawn in a `Modal` rather than an absolutely-positioned sibling, because a dropdown has to
 * escape its parent's bounds and a child that overflows its parent is clipped on Android. The cost
 * is that the panel is then laid out in window coordinates and has to be told where the trigger
 * is -- which is what the measurement is for. The button sits beside the other buttons on a
 * desktop window and in the top corner on a phone, and a panel pinned to either of those is in the
 * wrong place on the other.
 */
export function LanguagePicker({
  value,
  options,
  onChange,
  accessibilityLabel,
  title,
  searchPlaceholder,
  emptyLabel,
  closeLabel,
  compact = false,
  testIDs,
}: LanguagePickerProps) {
  // The anchor is also whether the panel is open: there is nowhere to draw it until the trigger
  // has been measured, so a separate `open` flag would have a frame where the two disagree.
  const [anchor, setAnchor] = useState<AnchorRect | null>(null)
  const trigger = useRef<TamaguiElement>(null)
  const window = useWindowDimensions()
  const keyboard = useKeyboardHeight()
  const insets = useScreenInsets()

  const selected = options.find((option) => option.value === value)

  /**
   * What is left of the window once the hardware and the keyboard have taken their share.
   *
   * **The keyboard comes out of the window, not out of nothing.** `useWindowDimensions` reports
   * the whole window whether or not a keyboard is over it, so a panel sized from it keeps the
   * height it had when it opened and the bottom of the list ends up underneath the keys -- with
   * no way to scroll to it, because as far as the list is concerned it is already fully visible.
   *
   * The larger of the two, never the sum: with a keyboard up, the home indicator is over the
   * keyboard rather than under the panel, so subtracting both takes a bar's worth of list away
   * for nothing.
   */
  const taken = Math.max(keyboard, insets.bottom)
  const placement =
    anchor === null
      ? null
      : panelPlacement(anchor, window.height - taken, GAP, MARGIN, MIN_PANEL_HEIGHT)

  return (
    <>
      {/* The ref is on a wrapper because `Button` is a plain function component and forwards none.
          Measuring the wrapper measures the button: it wraps it exactly. */}
      <XStack ref={trigger}>
        {/* `compact` removes the text button's horizontal padding entirely. The flag and chevron
            are wider than a glyph, so the padding sat to the right of the chevron and read as a
            gap twice the size of the ones between the round buttons beside it. */}
        <Button
          variant="ghost"
          // `md` either way: this is a bar control, and a bar control is the size of its touch
          // target rather than of its glyph. `compact` still removes the horizontal padding below,
          // so the flag and chevron sit tight inside it rather than spread by a text button's.
          size="md"
          // `compact` trims the text button's padding rather than removing it: at zero the
          // highlight sat hard against the flag on one side and the chevron on the other.
          {...(compact ? { paddingHorizontal: 8 } : {})}
          accessibilityLabel={accessibilityLabel}
          testID={testIDs.trigger}
          onPress={() => {
            // Measured on each open rather than once on layout: the window can be resized while
            // the picker is closed, and a stale rectangle puts the panel where the button was.
            measureAnchor(trigger.current, setAnchor)
          }}
        >
          <XStack alignItems="center" gap="$0.5">
            {/* The flag is not the label: it repeats across languages and three have none, so it
                stays out of the accessibility tree and `accessibilityLabel` names the control. */}
            <Text size="$title" aria-hidden>
              {selected?.flag ?? ''}
            </Text>
            <Icon name="chevronDown" size="$4" color="$textPrimary" />
          </XStack>
        </Button>
      </XStack>

      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAnchor(null)
        }}
      >
        {/* Catches the press that dismisses. A press anywhere outside the panel closes it, which
            is the only way out on desktop -- there is no back gesture to fall back on.

            Transparent, with no scrim: this reads as a dropdown from a button, and dimming the
            page behind it would say a modal had taken over the screen. */}
        <YStack
          flex={1}
          onPress={() => {
            setAnchor(null)
          }}
        >
          {anchor === null || placement === null ? null : (
            <YStack
              position="absolute"
              // One side or the other, never both: an `top` left over from the previous open
              // would stretch the panel between them.
              {...(placement.side === 'below'
                ? { top: placement.offset }
                : { bottom: placement.offset })}
              left={panelLeft(anchor, PANEL_WIDTH, window.width, MARGIN)}
              width={PANEL_WIDTH}
              // **The panel is what is capped, and the list takes what is left of it.** The cap
              // used to be on the list, with the chrome above it subtracted as a constant -- and
              // a constant that guesses the height of a heading, a search box, two gaps and the
              // padding is a constant that is wrong, which is why the last row sat under the
              // keyboard and the panel ran past the bottom of the screen. Nothing is estimated
              // now: the chrome takes what it needs and the list shrinks into the remainder.
              maxHeight={placement.available}
              gap="$1.5"
              padding="$2"
              borderRadius="$2"
              borderWidth={1}
              borderColor="$bordersColor"
              // The overlay surface rather than the raised one, because this floats above the
              // page: in a theme whose raised surface is authored flat against the base -- Classic
              // Dark's is black on near-black -- a raised panel is invisible but for its border.
              backgroundColor="$backgroundTertiary"
              // Swallows the press so a tap inside the panel does not reach the backdrop and close
              // it. Cheaper than a ref-and-contains check, and the same on both platforms.
              onPress={(event) => {
                event.stopPropagation()
              }}
              testID={testIDs.panel}
            >
              <XStack alignItems="center" justifyContent="space-between" gap="$1">
                <Text size="$title" weight="bold">
                  {title}
                </Text>
                {/* A cross rather than the word: it is the corner of a panel, where a cross is
                    read without being read, and the label still carries the meaning for anyone
                    who cannot see it. */}
                <Button
                  variant="ghost"
                  size="sm"
                  circular
                  accessibilityLabel={closeLabel}
                  testID={testIDs.close}
                  onPress={() => {
                    setAnchor(null)
                  }}
                  icon={<Icon name="x" size="$4" color="$textPrimary" />}
                />
              </XStack>

              {
                <LanguageChoiceList
                  value={value}
                  options={options}
                  searchPlaceholder={searchPlaceholder}
                  emptyLabel={emptyLabel}
                  testIDs={testIDs}
                  onChange={(next) => {
                    onChange(next)
                    setAnchor(null)
                  }}
                />
              }
            </YStack>
          )}
        </YStack>
      </Modal>
    </>
  )
}
