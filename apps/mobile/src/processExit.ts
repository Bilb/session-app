import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'

interface ProcessExitModule {
  terminate(): void
  /** Android only: iOS lets no app relaunch itself. */
  restart?(): void
}

/**
 * Ends the process at once, without the teardown `exit()` runs. See `modules/process-exit`.
 *
 * Null in a build made before the module existed, so the window port reports that it cannot close
 * rather than offering a Quit that does nothing.
 */
const ProcessExit = requireOptionalNativeModule<ProcessExitModule>('ProcessExit')

export const terminateProcess: (() => void) | null =
  ProcessExit === null
    ? null
    : () => {
        ProcessExit.terminate()
      }

/**
 * Ends the process and starts the app again, on Android. Null on iOS, which has no way to, and in
 * a build whose module predates it.
 */
export const restartProcess: (() => void) | null =
  Platform.OS !== 'android' || ProcessExit?.restart === undefined
    ? null
    : () => {
        ProcessExit.restart?.()
      }
