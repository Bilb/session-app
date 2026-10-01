import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { FullWindowOverlay } from 'react-native-screens'
import { YStack } from 'tamagui'

import { SPACE_SCALE } from './scales'
import { ToastCard } from './ToastCard'
import type { ToastHostProps } from './ToastHost.types'
import { useToastQueue } from './Toasts'

/**
 * Above the settings modal on iOS, which presents it in a window of its own: drawn in the app's
 * window, a toast raised from inside settings would be behind the panel that raised it. Android's
 * modal stack is a view in the app's window, and the toasts are already drawn after it.
 */
function AboveModals({ children }: { children: ReactNode }) {
  return Platform.OS === 'ios' ? <FullWindowOverlay>{children}</FullWindowOverlay> : children
}

/** Draws the toasts at the bottom of the screen, newest on top. */
export function ToastHost({ testID, closeTestID, closeLabel }: ToastHostProps) {
  const { toasts, dismiss } = useToastQueue()
  if (toasts.length === 0) return null
  return (
    <AboveModals>
      <YStack
        fullscreen
        justifyContent="flex-end"
        alignItems="center"
        paddingBottom={SPACE_SCALE['2xl']}
        gap="$md"
        pointerEvents="box-none"
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
    </AboveModals>
  )
}
