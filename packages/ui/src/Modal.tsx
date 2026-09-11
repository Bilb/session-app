import type { ReactNode } from 'react'
import { Modal as NativeModal } from 'react-native'
import { XStack, YStack } from 'tamagui'

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
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  actions,
  testID,
  closeTestID,
}: ModalProps) {
  return (
    <NativeModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* The scrim is its own layer so its opacity does not reach the dialog: an opacity on a
          parent applies to every descendant, which would make the dialog translucent too. */}
      <YStack fullscreen backgroundColor="$surfaceInk" opacity={0.6} />
      <YStack fullscreen alignItems="center" justifyContent="center" padding="$3" onPress={onClose}>
        <YStack
          width="100%"
          maxWidth={360}
          gap="$2"
          padding="$2.5"
          borderRadius="$4"
          backgroundColor="$backgroundPrimary"
          // Swallows the press, so a tap inside the dialog does not reach the backdrop.
          onPress={(event) => {
            event.stopPropagation()
          }}
          testID={testID}
        >
          <XStack alignItems="flex-start" gap="$1">
            {/* Centred across the full width, with the cross overlaid rather than taking a column,
                so the title is centred on the dialog and not on what is left of it. */}
            <Text flex={1} size="$titleLarge" weight="bold" textAlign="center" userSelect="none">
              {title}
            </Text>
            <YStack position="absolute" top={0} right={0}>
              <Button
                variant="ghost"
                size="xs"
                circular
                accessibilityLabel={closeLabel}
                testID={closeTestID}
                onPress={onClose}
                icon={<Icon name="x" size="$5" color="$textPrimary" />}
              />
            </YStack>
          </XStack>

          {children}

          {actions === undefined ? null : (
            <XStack justifyContent="space-around" alignItems="center" gap="$1">
              {actions}
            </XStack>
          )}
        </YStack>
      </YStack>
    </NativeModal>
  )
}
