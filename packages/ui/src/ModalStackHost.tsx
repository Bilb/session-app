import { Modal as NativeModal } from 'react-native'
import { ScrollView, useMedia, XStack, YStack } from 'tamagui'

import { useBackdropBlur } from './backdropBlur'
import { backChevron } from './backChevron'
import { Button } from './Button'
import { Icon } from './Icon'
import {
  ACTION_HEIGHT,
  HEADER_HEIGHT,
  PANEL_MAX_HEIGHT_RATIO,
  PANEL_RADIUS,
  PANEL_WIDTH,
} from './modalPanelMetrics'
import { useModalEntries, useModals } from './ModalsProvider'
import { Text } from './Text'
import { useThemeIsDark } from './UIProvider'

/** Matches `Modal`'s, so a stacked modal and an alert sit on the same backdrop. */
const SCRIM_OPACITY = 0.6

interface ModalStackHostProps {
  /** Names the close control for a screen reader, since it is drawn as a cross. */
  closeLabel: string
  /** Names the back control, which is drawn as a chevron. */
  backLabel: string
  testID?: string
  closeTestID?: string
  backTestID?: string
}

/**
 * Draws whatever `ModalStackProvider` is holding.
 *
 * **One react-native `Modal` for the whole stack, with the layers inside it.** Nesting the
 * platform's own modals is the obvious alternative and it is a trap: on iOS a second one presented
 * from inside the first is a separate window, so the two animate independently, the scrims
 * multiply, and dismissing the outer takes the inner with it whatever the stack says. Keeping one
 * window means the rules in `modalStack.ts` decide what closes, rather than the platform.
 *
 * Mounted once, beside the app's own content rather than inside it -- a modal presented from a
 * settings row has to outlive that row.
 */
export function ModalStackHost({
  closeLabel,
  backLabel,
  testID,
  closeTestID,
  backTestID,
}: ModalStackHostProps) {
  const entries = useModalEntries()
  const modals = useModals()
  const Blur = useBackdropBlur()
  const dark = useThemeIsDark()
  const wide = useMedia().gtSm

  const top = entries.at(-1)

  return (
    <NativeModal
      visible={entries.length > 0}
      transparent
      animationType="fade"
      // Escape on the web, the hardware button on Android. Both mean one level, which is not
      // always the modal: see `backAction`.
      onRequestClose={modals.back}
    >
      {Blur === null ? (
        /* Its own layer so the opacity does not reach the panels: an opacity on a parent applies
           to every descendant, which would make the content translucent too. */
        <YStack fullscreen backgroundColor="$surfaceInk" opacity={SCRIM_OPACITY} />
      ) : (
        <YStack fullscreen>
          <Blur dark={dark} />
        </YStack>
      )}

      {entries.map((entry, index) => {
        const screen = entry.stack.at(-1)
        const frontmost = entry === top
        return (
          <YStack
            key={entry.id}
            fullscreen
            alignItems="center"
            justifyContent="center"
            {...(wide ? { padding: '$xl' } : {})}
            // Only the frontmost layer answers a press: the ones below it are visible context,
            // not controls. Without this a tap meant for the scrim of the top modal lands on a
            // row of the one underneath.
            pointerEvents={frontmost ? 'auto' : 'none'}
            onPress={
              entry.dismissible
                ? () => {
                    modals.dismiss(entry.id)
                  }
                : undefined
            }
          >
            <YStack
              width="100%"
              {...(wide
                ? {
                    maxWidth: PANEL_WIDTH[entry.width],
                    maxHeight: `${String(PANEL_MAX_HEIGHT_RATIO * 100)}%`,
                    borderRadius: PANEL_RADIUS,
                  }
                : // **A height, not `flex`.** A narrow window gets the whole thing rather than a
                  // panel in the middle of one, and asking to fill the space says so directly --
                  // where a share of it depends on what the layer is doing with the rest.
                  { height: '100%' })}
              // **A nested modal sits on the nested surface, not on the same one again.** A modal
              // over a modal both drawn in `$backgroundSecondary` is invisible -- the panel is
              // there and reads as floating text over its parent's rows. `backgroundNested` is
              // the theme's own answer to a surface on a surface, and it stays themed, where
              // darkening one by hand would not.
              backgroundColor={index === 0 ? '$backgroundSecondary' : '$backgroundNested'}
              // Clipped so a row pressed at the top or bottom of the list stops at the corner
              // rather than squaring it off.
              overflow="hidden"
              testID={testID}
              onPress={(event) => {
                event.stopPropagation()
              }}
            >
              <XStack height={HEADER_HEIGHT} alignItems="center" paddingHorizontal="$xs">
                {/* The two controls hold their columns whether or not they are drawn, so the
                    title stays put as a screen is pushed. A title that shifts sideways when a
                    back chevron appears reads as the whole panel having moved. */}
                <YStack width={HEADER_HEIGHT}>
                  {entry.stack.length <= 1 ? null : (
                    <Button
                      variant="ghost"
                      size="md"
                      circular
                      accessibilityLabel={backLabel}
                      {...(backTestID === undefined ? {} : { testID: backTestID })}
                      onPress={modals.back}
                      icon={<Icon name={backChevron()} size="lg" color="$textPrimary" />}
                    />
                  )}
                </YStack>

                <Text flex={1} size="$bodyLarge" weight="bold" textAlign="center" userSelect="none">
                  {screen?.title ?? ''}
                </Text>

                <YStack width={HEADER_HEIGHT} alignItems="flex-end">
                  {!entry.dismissible ? null : (
                    <Button
                      variant="ghost"
                      size="md"
                      circular
                      accessibilityLabel={closeLabel}
                      {...(closeTestID === undefined ? {} : { testID: closeTestID })}
                      onPress={() => {
                        modals.dismiss(entry.id)
                      }}
                      icon={<Icon name="x" size="lg" color="$textPrimary" />}
                    />
                  )}
                </YStack>
              </XStack>

              {/* The body scrolls rather than the panel growing. A settings tree has one screen
                  longer than any window, and a panel sized to its tallest child would be that tall
                  on every other screen too.

                  Always, unlike the client, where scrolling is opt-in per modal and off by
                  default -- a screen that outgrows its panel is then clipped, and whether it does
                  depends on the window. */}
              <ScrollView
                // **Shrink, do not grow, on a window with room.** The panel is content-sized up
                // to its ceiling, and a body that grows into an auto-height parent has no free
                // space to take a share of -- so it resolves to nothing and the panel is just its
                // own header. Filling is only right where the panel fills the window.
                flexGrow={wide ? 0 : 1}
                flexShrink={1}
                // **Not a control, so it should not carry a focus ring.** Opening the platform's
                // modal moves focus to the first focusable node inside it, which on the web is
                // this scroller -- and the browser then draws its own ring, in its own colour,
                // around the whole body. It stays focusable and still scrolls from the keyboard;
                // what a keyboard reader follows is the ring on the row it tabs to.
                //
                // The style, not the width: `outline-style: auto` is the browser's own ring and
                // it draws at the platform's thickness whatever width is asked for, so a zero
                // width leaves it exactly as it was.
                focusStyle={{ outlineStyle: 'none' }}
              >
                {screen?.render() ?? null}
              </ScrollView>

              {screen?.footer === undefined ? null : (
                /* Equal widths across the panel with no gap and no margins -- the client's
                   `fillEqually`, and the same shape `Modal` draws an alert's actions in. The row
                   is needed rather than optional: the actions ask for an equal share with `fill`,
                   and a share of a column's height is nothing, so laid out down the panel they
                   collapse to none.

                   Clipped to the panel's own corners, so a cell that fills its width when held
                   stops at the rounded bottom edge rather than squaring it off. */
                <XStack
                  alignItems="stretch"
                  height={ACTION_HEIGHT}
                  {...(wide
                    ? {
                        borderBottomLeftRadius: PANEL_RADIUS,
                        borderBottomRightRadius: PANEL_RADIUS,
                      }
                    : {})}
                  overflow="hidden"
                >
                  {screen.footer()}
                </XStack>
              )}
            </YStack>
          </YStack>
        )
      })}
    </NativeModal>
  )
}
