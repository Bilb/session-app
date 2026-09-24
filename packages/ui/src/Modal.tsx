import type { ReactNode } from 'react'
import { Modal as NativeModal } from 'react-native'
import { XStack, YStack } from 'tamagui'

import { useBackdropBlur } from './backdropBlur'
import { useThemeIsDark } from './UIProvider'
import { Button } from './Button'
import { Icon } from './Icon'
import { Text } from './Text'
import { logical } from './logicalEdges'
import { ALERT_EDGE } from './alertEdge'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Centred, bold, with the close control beside it. */
  title: string
  /** Names the close control for a screen reader, since it is drawn as a cross. */
  closeLabel: string
  /**
   * Whether the cross in the corner is drawn.
   *
   * On for a dialog that shows something, where closing is the only thing to do with it. **Off for
   * one that asks a question**: a cross is a third answer next to the two in the actions row, and
   * an unlabelled one -- somebody deciding whether to leave the app wants to read the word Cancel,
   * not infer it from a glyph. Such a dialog puts its own cancel in `actions`.
   */
  showClose?: boolean
  /**
   * Whether a press outside, Escape, or the Android back button closes it.
   *
   * Defaults to whatever `showClose` is, because the two say the same thing: a dialog offering
   * a cross is one you may simply leave. **A dialog asking a question is not**, and leaving these
   * on while the cross was hidden put back the third, unlabelled answer the cross was removed to
   * avoid -- reachable by a stray tap on the scrim, and reachable while the destructive action
   * it was confirming was already running.
   */
  dismissible?: boolean
  children: ReactNode
  /** The row of actions along the bottom. Text buttons, in the client's shape. */
  actions?: ReactNode
  testID: string
  closeTestID: string
  /**
   * How far the content sits from the dialog's sides and its bottom edge.
   *
   * **The client has more than one dialog and they do not share these.** `Modal.swift` is the
   * alert -- 35 across, and 4 under a final child that is a full-width row of buttons reaching the
   * rounded corners. `MutipleLinksModal` is its own screen with its own rhythm: narrower sides, and
   * room under a box that is not trying to touch anything. Defaulting to the alert's keeps every
   * caller that wants one honest, and the other says so.
   */
  sideInset?: number
  bottomInset?: number
}

/**
 * The dialog's own metrics, from the legacy client rather than from our scales.
 *
 * `Modal.swift` builds this with numbers that are not on either type or space ladder -- an 11pt
 * radius, a 51pt button, 24 above the title and 4 below the buttons -- so they are written here as
 * themselves. Rounded onto the nearest rung instead, the dialog reads as a different one: heavier
 * padding, rounder corners and shorter buttons.
 */
const RADIUS = 11
const SIDE_INSET = 35
const TOP_INSET = 24
const BOTTOM_INSET = 4
const CONTENT_GAP = 8

/**
 * The extra air above the actions, on top of the body's own rhythm.
 *
 * The row is a different kind of thing from the lines above it -- it runs the full width and is
 * held down at the dialog's edge -- and at the body's gap it read as another line of the copy.
 */
const ACTIONS_GAP = 16

/**
 * How far the close's **touch target** sits from the dialog's own corner.
 *
 * It belongs to the dialog rather than to the column of text, so it is pulled back out of the
 * content inset. Small because the target is much bigger than the glyph -- what the eye measures
 * is the cross, which ends up about ten points in from each edge, where the client draws it.
 */
const CLOSE_INSET = 2
const ACTION_HEIGHT = 51

/**
 * Something asked over the top of the page.
 *
 * Drawn in react-native's `Modal` rather than an absolutely-positioned panel, for the same reason
 * the language picker is: a child that overflows its parent is clipped on Android.
 *
 * **Dimmed behind, unlike the picker.** A dropdown belongs to the control that opened it; this
 * stops the page until it is answered, and the dimming says so.
 *
 * The shape is the desktop client's `SessionWrapperModal`: a header with the title and the exit
 * cross, the body, then a row of **text** buttons. Text rather than filled, because a filled button
 * reads as the safe default by looking like a primary action -- and here the emphasised option is
 * usually the one to think twice about.
 */
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  actions,
  showClose = true,
  dismissible = showClose,
  testID,
  closeTestID,
  sideInset = SIDE_INSET,
  bottomInset = BOTTOM_INSET,
}: ModalProps) {
  /**
   * **iOS blurs what is behind a dialog; Android and the desktop client only darken it.** Null on
   * both of those, and the scrim below is then the whole backdrop.
   */
  const Blur = useBackdropBlur()
  const dark = useThemeIsDark()

  // Named once: the same answer has to reach the scrim, Escape and the hardware back button, or
  // the dialog is dismissible by whichever of them was forgotten.
  const dismiss = dismissible ? onClose : undefined

  return (
    <NativeModal visible={open} transparent animationType="fade" onRequestClose={dismiss}>
      {Blur === null ? null : (
        <YStack fullscreen>
          <Blur dark={dark} />
        </YStack>
      )}
      {/* **A scrim only where there is no blur.** Where there is one there is no scrim at all,
          which is the legacy client's arrangement: `Modal.dimmingView` is a bare
          `UIVisualEffectView` pinned to the window, with no tint and no alpha over it. A dim on top
          of a blur hides the thing the blur exists to show. */}
      {Blur !== null ? null : <YStack fullscreen backgroundColor="$scrim" />}
      {/* A press outside the dialog lands here, behind it, rather than on its container: a
          container that takes presses stops its body scrolling. See `ModalStackHost`'s backdrop. */}
      <YStack fullscreen {...(dismiss === undefined ? {} : { onPress: dismiss })} />
      <YStack
        fullscreen
        alignItems="center"
        justifyContent="center"
        padding="$xl"
        pointerEvents="box-none"
      >
        <AlertBox
          title={title}
          closeLabel={closeLabel}
          showClose={showClose}
          onClose={onClose}
          actions={actions}
          testID={testID}
          closeTestID={closeTestID}
          sideInset={sideInset}
          bottomInset={bottomInset}
        >
          {children}
        </AlertBox>
      </YStack>
    </NativeModal>
  )
}

interface AlertBoxProps {
  title: string
  closeLabel: string
  showClose: boolean
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
  testID: string
  closeTestID: string
  sideInset?: number
  bottomInset?: number
}

/**
 * The dialog itself, without the window it is shown in.
 *
 * Apart from `Modal` so there is one alert in the app however it is presented: `Modal` puts it in a
 * platform modal of its own, and the modal stack draws it over a settings panel. A confirm drawn as
 * a panel would have neither the alert's metrics nor its shape.
 */
export function AlertBox({
  title,
  closeLabel,
  showClose,
  onClose,
  children,
  actions,
  testID,
  closeTestID,
  sideInset = SIDE_INSET,
  bottomInset = BOTTOM_INSET,
}: AlertBoxProps) {
  return (
    <YStack
      width="100%"
      maxWidth={360}
      gap={CONTENT_GAP}
      paddingTop={TOP_INSET}
      paddingHorizontal={sideInset}
      paddingBottom={bottomInset}
      borderRadius={RADIUS}
      // The surface above the page, which is what an alert sits on in the client.
      backgroundColor="$backgroundSecondary"
      // Its edge against a dimmed page is the same surface over another, so each platform draws
      // the separation its client does.
      {...ALERT_EDGE}
      testID={testID}
    >
      <XStack alignItems="flex-start" gap="$xs">
        {/* Centred across the full width, with the cross overlaid rather than taking a column,
            so the title is centred on the dialog and not on what is left of it. */}
        {/* 17 on iOS, 16 on Android. */}
        <Text flex={1} size="$bodyLarge" weight="bold" textAlign="center" userSelect="none">
          {title}
        </Text>
        {!showClose ? null : (
          <YStack
            position="absolute"
            top={-(TOP_INSET - CLOSE_INSET)}
            // The trailing corner, which is the right one only until the layout is mirrored.
            {...logical({ insetEnd: -(sideInset - CLOSE_INSET) })}
          >
            <Button
              variant="ghost"
              // The size of the touch target rather than of the glyph, which is the same
              // reason the onboarding back control is `md`: an `xs` button is a 24pt square to
              // hit, and a cross in the corner of a dialog is exactly where that is felt.
              size="md"
              circular
              accessibilityLabel={closeLabel}
              testID={closeTestID}
              onPress={onClose}
              icon={<Icon name="x" size="lg" color="$textPrimary" />}
            />
          </YStack>
        )}
      </XStack>

      {children}

      {actions === undefined ? null : (
        /* Equal widths running the full width of the dialog, with no gap and no side margins
           -- the client's `fillEqually`. Each action is as tall as a control rather than as
           tall as its label. */
        /* Clipped to the dialog's own corners too, so a cell that fills its width when held
           stops at the rounded bottom edge rather than squaring it off. */
        <XStack
          alignItems="stretch"
          marginTop={ACTIONS_GAP}
          marginHorizontal={-sideInset}
          marginBottom={-bottomInset}
          height={ACTION_HEIGHT}
          borderBottomLeftRadius={RADIUS}
          borderBottomRightRadius={RADIUS}
          overflow="hidden"
        >
          {/* Each action takes an equal share of the full width -- the client's `fillEqually`
              -- with no gap, so the two share an edge the way its alert's buttons do. The
              actions ask for that themselves with `fill`, because a fragment of them arrives
              here as one child and cannot be divided from the outside. */}
          {actions}
        </XStack>
      )}
    </YStack>
  )
}
