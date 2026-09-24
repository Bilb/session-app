import { Fragment } from 'react'
import { Modal as NativeModal } from 'react-native'
import { ScrollView, useMedia, XStack, YStack } from 'tamagui'

import { useBackdropBlur } from './backdropBlur'
import { useGlass } from './glass'
import { backChevron } from './backChevron'
import { Button } from './Button'
import { Icon } from './Icon'
import { AlertBox } from './Modal'
import {
  ACTION_HEIGHT,
  HEADER_HEIGHT,
  PANEL_INSET_RATIO,
  PANEL_RADIUS,
  PANEL_SHADOW_BLUR,
  PANEL_WIDTH,
} from './modalPanelMetrics'
import { useModalEntries, useModals, type OpenModal } from './ModalsProvider'
import { PressArea } from './PressArea'
import { SIZE_SCALE } from './scales'
import { Text } from './Text'
import { useThemeIsDark } from './UIProvider'
import { useScreenInsets } from './screenInsets'
import { useTokenColor } from './useTokenColor'
import { useWindowSize } from './useWindowSize'

interface ModalStackHostProps {
  /** Names the close control for a screen reader, since it is drawn as a cross. */
  closeLabel: string
  /** Names the back control, which is drawn as a chevron. */
  backLabel: string
  testID?: string
  closeTestID?: string
  backTestID?: string
  /**
   * Which of the open modals this draws. All of them unless told otherwise: on a phone the
   * settings panel is presented natively and only the alerts come through here. See
   * `ModalStackRoot`.
   */
  entries?: readonly OpenModal[]
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
  entries: only,
}: ModalStackHostProps) {
  const all = useModalEntries()
  const entries = only ?? all
  const modals = useModals()
  const Blur = useBackdropBlur()
  const Glass = useGlass()
  const dark = useThemeIsDark()
  const wide = useMedia().gtSm
  const shadowColor = useTokenColor('$shadow')

  // The desktop client's anchoring: a fixed margin from the top of the window and the same at the
  // bottom, in window height rather than a percentage -- a percentage of padding is measured
  // against the width.
  const { height: windowHeight } = useWindowSize()
  const inset = Math.round(windowHeight * PANEL_INSET_RATIO)
  const panelHeight = windowHeight - 2 * inset

  const top = entries.at(-1)
  // The phone's panel is the whole screen, so it keeps its header out from under the status bar
  // and its content off the home indicator.
  const screenInsets = useScreenInsets()
  // **A phone's settings slide up**, as a modal does there; a panel over a wide window fades in,
  // as the desktop client's does. Decided by what opens the stack: an alert with nothing under it
  // fades on both.
  const slides = !wide && entries[0]?.kind === 'panel'

  return (
    <NativeModal
      visible={entries.length > 0}
      transparent
      animationType={slides ? 'slide' : 'fade'}
      // Escape on the web, the hardware button on Android. Both mean one level, which is not
      // always the modal: see `backAction`.
      onRequestClose={modals.back}
    >
      {Blur === null ? (
        // The same backdrop as an alert's, so a panel and a dialog over it dim the page alike.
        <YStack fullscreen backgroundColor="$scrim" />
      ) : (
        <YStack fullscreen>
          <Blur dark={dark} />
        </YStack>
      )}

      {entries.map((entry, index) => {
        const screen = entry.stack.at(-1)
        const frontmost = entry === top
        const dismiss = entry.dismissible
          ? () => {
              modals.dismiss(entry.id)
            }
          : undefined

        // **Each layer above the first sets back what it covers**, the way the desktop client gives
        // every modal a backdrop of its own: a confirm over settings should push settings back, not
        // sit level with it. With the backdrop the platform draws -- a blur on iOS, so an alert over
        // the panel looks as it does on its own; elsewhere black, so the dims compound into darker
        // rather than lighter.
        //
        // A layer of its own drawn before the modal, not a child of it: on the web an absolutely
        // placed child paints over its in-flow siblings whatever the order, so a dim inside the
        // layer covered the very dialog it was meant to sit behind.
        const layerScrim =
          index === 0 ? null : Blur === null ? (
            <YStack fullscreen backgroundColor="$scrim" pointerEvents="none" />
          ) : (
            <YStack fullscreen pointerEvents="none">
              <Blur dark={dark} />
            </YStack>
          )

        // **A press outside the modal lands on a layer of its own**, behind it, rather than on the
        // modal's container with the modal stopping it. A container that takes presses is a touch
        // target on native wherever its children are not, so a drag starting in a gap between
        // groups or on a disabled row went to it instead of the scroller, and did not scroll. The
        // layer above lets every touch outside the modal through to this one.
        const backdrop = (
          <YStack
            fullscreen
            pointerEvents={frontmost && dismiss !== undefined ? 'auto' : 'none'}
            {...(dismiss === undefined ? {} : { onPress: dismiss })}
          />
        )

        if (entry.kind === 'alert')
          return (
            <Fragment key={entry.id}>
              {layerScrim}
              {backdrop}
              <YStack
                fullscreen
                alignItems="center"
                justifyContent="center"
                padding="$xl"
                pointerEvents={frontmost ? 'box-none' : 'none'}
              >
                <AlertBox
                  title={screen?.title ?? ''}
                  closeLabel={closeLabel}
                  // See `ModalPresentation.showClose`: leaving from the scrim and offering a cross
                  // are separate questions.
                  showClose={entry.showClose}
                  onClose={() => {
                    modals.dismiss(entry.id)
                  }}
                  actions={screen?.footer?.()}
                  testID={entry.testID ?? testID ?? ''}
                  closeTestID={entry.closeTestID ?? closeTestID ?? ''}
                >
                  {screen?.render() ?? null}
                </AlertBox>
              </YStack>
            </Fragment>
          )

        return (
          <Fragment key={entry.id}>
            {layerScrim}
            {backdrop}
            <YStack
              fullscreen
              alignItems="center"
              {...(wide ? { paddingHorizontal: '$lg', paddingTop: inset } : {})}
              // Only the frontmost layer answers a press: the ones below it are visible context,
              // not controls. Without this a tap meant for the scrim of the top modal lands on a
              // row of the one underneath. `box-none` passes a touch outside the panel down to the
              // backdrop.
              pointerEvents={frontmost ? 'box-none' : 'none'}
            >
              <YStack
                width="100%"
                {...(wide
                  ? {
                      maxWidth: PANEL_WIDTH[entry.width],
                      // **One height for every screen, anchored to the top.** A panel sized to
                      // each screen moves its bottom edge on every push and, centred, its top edge
                      // too -- which reads as the panel jumping rather than the screen changing.
                      // Fixed, a push is only the content changing, and a transition between two
                      // screens has two boxes of the same size to move between.
                      height: panelHeight,
                      borderRadius: PANEL_RADIUS,
                      borderWidth: 1,
                      borderColor: '$bordersColor',
                      boxShadow: `0px 0px ${String(PANEL_SHADOW_BLUR[dark ? 'dark' : 'light'])}px 0px ${shadowColor}`,
                    }
                  : // **A height, not `flex`.** A narrow window gets the whole thing rather than a
                    // panel in the middle of one, and asking to fill the space says so directly --
                    // where a share of it depends on what the layer is doing with the rest.
                    {
                      height: '100%',
                      paddingTop: screenInsets.top,
                      paddingBottom: screenInsets.bottom,
                    })}
                // The page's own surface, lifted by the border and the shadow rather than by a
                // lighter colour: the desktop client's panel is near-black on a near-black page.
                backgroundColor="$backgroundPrimary"
                // Clipped so a row pressed at the top or bottom of the list stops at the corner
                // rather than squaring it off.
                overflow="hidden"
                testID={testID}
              >
                <XStack height={HEADER_HEIGHT} alignItems="center" paddingHorizontal="$xs">
                  {/* The two controls hold their columns whether or not they are drawn, so the
                      title stays put as a screen is pushed. A title that shifts sideways when a
                      back chevron appears reads as the whole panel having moved. */}
                  <YStack width={HEADER_HEIGHT}>
                    {entry.stack.length <= 1 ? (
                      // **On a phone the close is where a modal's always is**: the leading corner,
                      // on the first screen only -- a pushed screen has back there instead. The wide
                      // panel keeps the desktop client's close in the trailing corner.
                      wide || !entry.dismissible ? null : (
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
                      )
                    ) : (
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

                  {/* One size on every screen of a panel. A push changes what is under the
                      header, not the header's weight. */}
                  <Text
                    flex={1}
                    size="$title"
                    weight="semibold"
                    textAlign="center"
                    userSelect="none"
                  >
                    {screen?.title ?? ''}
                  </Text>

                  <YStack width={HEADER_HEIGHT} alignItems="flex-end">
                    {!wide || !entry.dismissible ? null : Glass !== null ? (
                      // On glass where the platform has it -- iOS 26 -- as the phone's settings
                      // close sits in the system bar's glass button, so the two read as one control.
                      <PressArea
                        accessibilityLabel={closeLabel}
                        {...(closeTestID === undefined ? {} : { testID: closeTestID })}
                        onPress={() => {
                          modals.dismiss(entry.id)
                        }}
                      >
                        {() => (
                          <Glass size={SIZE_SCALE['2xl']} dark={dark}>
                            <Icon name="x" size="lg" color="$textPrimary" />
                          </Glass>
                        )}
                      </PressArea>
                    ) : (
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

                {/* **Every screen stays mounted; only the frontmost is shown.** Going back is
                    then a return to the screen as it was left -- scrolled where it was, holding
                    whatever it held -- rather than a fresh copy starting from the top. The others
                    are hidden from sight, from presses and from a screen reader. */}
                {/* `relative` so the screens below are placed against this body: on the web a
                    stack is `static` unless it says so, and an absolute child then resolves
                    against the page -- see `containingBlock.contract.test.ts`. */}
                <YStack flex={1} position="relative">
                  {entry.stack.map((held, at) => {
                    const showing = at === entry.stack.length - 1
                    return (
                      <YStack
                        key={held.key}
                        fullscreen
                        opacity={showing ? 1 : 0}
                        pointerEvents={showing ? 'auto' : 'none'}
                        aria-hidden={!showing}
                      >
                        {/* Each screen scrolls within the panel rather than growing it. */}
                        <ScrollView
                          flex={1}
                          // **Not a control, so it should not carry a focus ring.** Opening the
                          // platform's modal moves focus to the first focusable node inside it,
                          // which on the web is a scroller -- and the browser then draws its own
                          // ring, in its own colour, around the whole body. It stays focusable and
                          // still scrolls from the keyboard; what a keyboard reader follows is the
                          // ring on the row it tabs to.
                          //
                          // The style, not the width: `outline-style: auto` is the browser's own
                          // ring and it draws at the platform's thickness whatever width is asked
                          // for, so a zero width leaves it exactly as it was.
                          focusStyle={{ outlineStyle: 'none' }}
                        >
                          {held.render()}
                        </ScrollView>
                      </YStack>
                    )
                  })}
                </YStack>

                {screen?.footer === undefined ? null : (
                  /* Equal widths across the panel with no gap and no margins -- the client's
                     `fillEqually`, and the same shape `Modal` draws an alert's actions in. The row
                     is needed rather than optional: the actions ask for an equal share with
                     `fill`, and a share of a column's height is nothing, so laid out down the
                     panel they collapse to none. */
                  <XStack alignItems="stretch" height={ACTION_HEIGHT}>
                    {screen.footer()}
                  </XStack>
                )}
              </YStack>
            </YStack>
          </Fragment>
        )
      })}
    </NativeModal>
  )
}
