import { requireOptionalNativeModule } from 'expo'

interface ProcessExitModule {
  terminate(): void
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
