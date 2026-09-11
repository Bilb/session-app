import type { ReactNode } from 'react'
import { Modal as NativeModal } from 'react-native'
import { YStack } from 'tamagui'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * Something asked over the top of the page.
 *
 * Drawn in react-native's `Modal` rather than an absolutely-positioned panel, for the same reason
 * the language picker is: a child that overflows its parent is clipped on Android, and anything
 * that floats over a screen has to escape whatever it was declared inside.
 *
 * **Dimmed behind, unlike the picker.** A dropdown is part of the control that opened it and should
 * leave the page alone; this is a question that stops the page until it is answered, and the dimming
 * is what says so. Pressing outside answers it the same way the close control does, because every
 * modal here is a question you are allowed to decline.
 */
export function Modal({ open, onClose, children }: ModalProps) {
  return (
    <NativeModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        padding="$3"
        backgroundColor="$surfaceInk"
        opacity={0.6}
      />
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        alignItems="center"
        justifyContent="center"
        padding="$3"
        onPress={onClose}
      >
        {/* Swallows the press, so a tap inside the dialog does not reach the backdrop. */}
        <YStack
          width="100%"
          alignItems="center"
          onPress={(event) => {
            event.stopPropagation()
          }}
        >
          {children}
        </YStack>
      </YStack>
    </NativeModal>
  )
}
