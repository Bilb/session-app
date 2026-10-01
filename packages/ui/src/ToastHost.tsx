import { Portal, YStack } from 'tamagui'

import { ToastCard } from './ToastCard'
import type { ToastHostProps } from './ToastHost.types'
import { useToastQueue } from './Toasts'

/**
 * Above everything, the settings modal included.
 *
 * react-native-web draws a modal in a portal of its own at 9999, so a toast drawn inside the app
 * would sit under an open settings panel -- where a copy made from that panel is announced.
 */
const TOAST_LAYER = 10_000

/**
 * Draws the toasts in the trailing bottom corner, newest on top.
 *
 * In a portal of its own, which covers the window and lets presses through everywhere but on a
 * toast. Mounted once at the root, beside the modal stack.
 */
export function ToastHost({ testID, closeTestID, closeLabel }: ToastHostProps) {
  const { toasts, dismiss } = useToastQueue()
  if (toasts.length === 0) return null
  return (
    <Portal zIndex={TOAST_LAYER}>
      {/* Laid out in the portal's own box, which covers the window, rather than positioned in it:
          the column fills it and puts the toasts in its trailing bottom corner. */}
      <YStack
        flex={1}
        justifyContent="flex-end"
        alignItems="flex-end"
        padding="$md"
        gap="$md"
        pointerEvents="box-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastCard
            key={toast.serial}
            text={toast.text}
            testID={testID}
            closeTestID={closeTestID}
            closeLabel={closeLabel}
            onPress={() => {
              dismiss(toast.serial)
            }}
          />
        ))}
      </YStack>
    </Portal>
  )
}
