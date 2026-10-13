import type { Rows } from '@session/basic-types'
import type { DeviceFacts, ExportPart } from '@session/logging'
import { requireOptionalNativeModule } from 'expo'

/** What `modules/session-logs` reports; nulls where the platform cannot say. */
interface NativeDiagnostics extends Pick<DeviceFacts, 'model' | 'install'> {
  usedBytes: number | null
  availableBytes: number | null
  totalBytes: number | null
  freeBytes: number | null
  /** Null where the platform could not say. */
  lowPowerMode: boolean | null
  permissions: Rows
}

interface SessionLogsModule {
  gzip(parts: readonly ExportPart[], directory: string, outPath: string): Promise<number>
  diagnostics(): Promise<NativeDiagnostics>
  /** Android only: the system asking for memory back, by `onTrimMemory` level. */
  addListener(
    event: 'onMemoryPressure',
    listener: (pressure: { level: string }) => void,
  ): { remove(): void }
}

/**
 * The logs' native half: compression off the JS thread, and the device facts JavaScript cannot
 * read. See `modules/session-logs`.
 *
 * Null in a build made before the module existed, so the export is left out rather than offered
 * and then failing.
 */
export const SessionLogs = requireOptionalNativeModule<SessionLogsModule>('SessionLogs')
