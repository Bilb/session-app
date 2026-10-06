import { toggleDebugMode } from '@session/app'
import { tr } from '@session/localization'
import { useToast } from '@session/ui'
import { useRef } from 'react'

/** How many presses on the build stamp turn debug mode over, either way. */
const PRESSES_FOR_DEBUG = 10

/**
 * The build stamp's press handler, the same on every platform: every tenth press turns debug mode
 * over, and a toast says which way it went.
 */
export function useDebugModePresses(): () => void {
  const toasts = useToast()
  const presses = useRef(0)
  return () => {
    presses.current += 1
    if (presses.current < PRESSES_FOR_DEBUG) return
    presses.current = 0
    toasts.show(toggleDebugMode() ? tr('debugModeEnabled') : tr('debugModeDisabled'), {
      id: 'debug-mode',
    })
  }
}
