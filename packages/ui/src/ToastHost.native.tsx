import { YStack } from 'tamagui'

import { SPACE_SCALE } from './scales'
import { ToastCard } from './ToastCard'
import { useToastQueue } from './Toasts'

/**
 * Draws the toasts at the bottom of the screen, over the app.
 *
 * **Not over an open modal**: react-native's `Modal` is a window of its own, and this is not in it.
 * Nothing on the phones raises a toast yet -- their copy confirms on the button, as iOS's does -- so
 * the first caller that needs one over settings has to bring it into that window.
 */
export function ToastHost({ testID }: { testID: string }) {
  const { toasts, dismiss } = useToastQueue()
  if (toasts.length === 0) return null
  return (
    <YStack
      position="absolute"
      bottom={SPACE_SCALE['2xl']}
      left={0}
      right={0}
      alignItems="center"
      gap="$xs"
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.serial}
          text={toast.text}
          testID={testID}
          onPress={() => {
            dismiss(toast.serial)
          }}
        />
      ))}
    </YStack>
  )
}
