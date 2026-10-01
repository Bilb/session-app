import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { FullWindowOverlay } from 'react-native-screens'
import { YStack } from 'tamagui'

import { useScreenInsets } from './screenInsets'
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

/**
 * The newest toast, centred above the bottom of the screen's safe area.
 *
 * One at a time, as the platform's own toasts are: there is no room on a phone for a stack, and a
 * newer message replaces the one before it rather than pushing it up the screen.
 */
export function ToastHost({ testID, closeTestID, closeLabel }: ToastHostProps) {
  const { toasts, dismiss } = useToastQueue()
  const insets = useScreenInsets()
  const newest = toasts[0]
  if (newest === undefined) return null
  return (
    <AboveModals>
      <YStack
        fullscreen
        justifyContent="flex-end"
        alignItems="center"
        paddingHorizontal="$md"
        paddingBottom={insets.bottom + SPACE_SCALE.xl}
        pointerEvents="box-none"
      >
        <ToastCard
          key={newest.serial}
          text={newest.text}
          testID={testID}
          closeTestID={closeTestID}
          closeLabel={closeLabel}
          onPress={() => {
            dismiss(newest.serial)
          }}
        />
      </YStack>
    </AboveModals>
  )
}
