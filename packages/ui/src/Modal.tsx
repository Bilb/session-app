import type { ReactNode } from 'react'
import { Modal as NativeModal } from 'react-native'
import { XStack, YStack } from 'tamagui'

import { useBackdropBlur } from './backdropBlur'
import { Button } from './Button'
import { Icon } from './Icon'
import { Text } from './Text'

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
  children: ReactNode
  /** The row of actions along the bottom. Text buttons, in the client's shape. */
  actions?: ReactNode
  testID: string
  closeTestID: string
}

/**
 * Something asked over the top of the page.
 *
 * Drawn in react-native's `Modal` rather than an absolutely-positioned panel, for the same reason
 * the language picker is: a child that overflows its parent is clipped on Android, and anything
 * that floats over a screen has to escape whatever it was declared inside.
 *
 * **Dimmed behind, unlike the picker.** A dropdown is part of the control that opened it and should
 * leave the page alone; this is a question that stops the page until it is answered, and the
 * dimming is what says so. Pressing outside answers it the same way the cross does.
 *
 * The shape is the desktop client's `SessionWrapperModal`: a header carrying the title and the exit
 * cross, the body, then a row of **text** buttons. Text rather than filled, because a filled button
 * in a dialog reads as the safe default purely by looking like a primary action -- and in these
 * dialogs the emphasised option is usually the one to think twice about.
 */
/**
 * The dialog's own metrics, from the legacy client rather than from our scales.
 *
 * `Modal.swift` builds this with numbers that are not on either type or space ladder -- an 11pt
 * radius, a 51pt button, 24 above the title and 4 below the buttons -- so they are written here as
 * themselves. Rounding them onto the nearest rung is what made ours read as a different dialog:
 * the padding was heavier, the corners rounder and the buttons shorter.
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
 * It belongs to the dialog and not to the column of text, so it is pulled back out of the content
 * inset: at 35 from the side it floated a third of the way across the title, which is where the
 * client has nothing at all.
 *
 * Small because the target is much bigger than the glyph -- see the `md` below. What the eye
 * measures is the cross, and that ends up about ten points in from each edge, which is where the
 * client draws it.
 */
const CLOSE_INSET = 2
const ACTION_HEIGHT = 51

/**
 * How dark the scrim is where there is no blur behind the dialog.
 *
 * **Where there is one there is no scrim at all**, which is the legacy client's arrangement:
 * `Modal.dimmingView` is a bare `UIVisualEffectView` pinned to the window, with no tint and no
 * alpha over it. The two do the same job, and a dim on top of a blur hides the thing the blur
 * exists to show -- a dark rectangle that might as well not have been blurred.
 */
const SCRIM_OPACITY = 0.6

export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  actions,
  showClose = true,
  testID,
  closeTestID,
}: ModalProps) {
  /**
   * **iOS blurs what is behind a dialog; Android and the desktop client only darken it.** Null on
   * both of those, and the scrim below is then the whole backdrop.
   */
  const Blur = useBackdropBlur()

  return (
    <NativeModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {Blur === null ? null : (
        <YStack fullscreen>
          <Blur />
        </YStack>
      )}
      {/* The scrim is its own layer so its opacity does not reach the dialog: an opacity on a
          parent applies to every descendant, which would make the dialog translucent too. */}
      {Blur !== null ? null : (
        <YStack fullscreen backgroundColor="$surfaceInk" opacity={SCRIM_OPACITY} />
      )}
      <YStack fullscreen alignItems="center" justifyContent="center" padding="$3" onPress={onClose}>
        <YStack
          width="100%"
          maxWidth={360}
          gap={CONTENT_GAP}
          paddingTop={TOP_INSET}
          paddingHorizontal={SIDE_INSET}
          paddingBottom={BOTTOM_INSET}
          borderRadius={RADIUS}
          // The surface above the page, which is what an alert sits on in the client.
          backgroundColor="$backgroundSecondary"
          // Swallows the press, so a tap inside the dialog does not reach the backdrop.
          onPress={(event) => {
            event.stopPropagation()
          }}
          testID={testID}
        >
          <XStack alignItems="flex-start" gap="$1">
            {/* Centred across the full width, with the cross overlaid rather than taking a column,
                so the title is centred on the dialog and not on what is left of it. */}
            {/* 17 on iOS, 16 on Android; ours was 20. */}
            <Text flex={1} size="$bodyLarge" weight="bold" textAlign="center" userSelect="none">
              {title}
            </Text>
            {!showClose ? null : (
              <YStack
                position="absolute"
                top={-(TOP_INSET - CLOSE_INSET)}
                right={-(SIDE_INSET - CLOSE_INSET)}
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
                  icon={<Icon name="x" size="$5" color="$textPrimary" />}
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
              marginHorizontal={-SIDE_INSET}
              marginBottom={-BOTTOM_INSET}
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
      </YStack>
    </NativeModal>
  )
}
