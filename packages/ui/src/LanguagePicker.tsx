import { useRef, useState } from 'react'
import { Modal, useWindowDimensions } from 'react-native'
import { XStack, YStack, type TamaguiElement } from 'tamagui'

import { measureAnchor, panelLeft, panelPlacement, type AnchorRect } from './anchorRect'
import { Button } from './Button'
import { Icon } from './Icon'
import { LanguageChoiceList } from './LanguageChoiceList'
import { Text } from './Text'
import type { LanguagePickerProps } from './LanguagePicker.types'

/** Wide enough for the longest language name, narrow enough for a phone. */
const PANEL_WIDTH = 320
/** The smallest gap worth keeping between the panel and the window's edge. */
const MARGIN = 12
/** Clear of the trigger, close enough to read as hanging from it. */
const GAP = 6
/** The panel's own chrome above the list: the heading row, the search box and the padding. */
const PANEL_CHROME = 110
/** Below this the panel is not worth opening downwards, and it flips above the trigger instead. */
const MIN_PANEL_HEIGHT = 260

/**
 * The control that changes the app's language: a flag, a chevron, and a panel under it.
 *
 * **One file rather than a web/native pair**, which is the exception to how this package usually
 * splits. The two platforms do behave differently -- desktop always picks the language itself,
 * where a phone should hand over to the OS's own per-app language screen when it has one -- but
 * that difference is *whether the OS offers the screen*, not *which bundler resolved the file*.
 * So it arrives as `onOpenSystemSettings`: present, and the trigger hands straight over and no
 * panel opens at all; absent, and the panel does the work. Desktop never passes it. A phone passes
 * it only on an OS version that has somewhere to go. Splitting by platform instead would have
 * hard-coded "Android has this" into the file name, and Android has had it only since 13.
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
  onOpenSystemSettings,
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

  const selected = options.find((option) => option.value === value)

  const placement =
    anchor === null ? null : panelPlacement(anchor, window.height, GAP, MARGIN, MIN_PANEL_HEIGHT)

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
          {...(compact ? { paddingHorizontal: 0 } : {})}
          accessibilityLabel={accessibilityLabel}
          testID={testIDs.trigger}
          onPress={() => {
            // **Where the OS owns the setting there is no panel at all.** A dropdown whose only
            // row is "go somewhere else" is a step that asks a question it already knows the
            // answer to, so the trigger raises the hand-off directly and the caller confirms it.
            if (onOpenSystemSettings !== undefined) {
              onOpenSystemSettings()
              return
            }
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
                  // Whatever room is left below the trigger, less the panel's own chrome, so the
                  // list scrolls internally instead of running off the bottom of a short window.
                  maxHeight={Math.max(120, placement.available - PANEL_CHROME)}
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
