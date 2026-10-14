import { exportLogs, requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { useSessionActions } from '@session/state'
import { useToast } from '@session/ui'
import { useState } from 'react'

/** An Export Logs button's state and its press, the same wherever the button is. */
export interface LogExport {
  /** False where the build cannot export: the button is left out or disabled. */
  canExport: boolean
  /** True while an export runs: the button shows a spinner and does nothing. */
  exporting: boolean
  start: () => void
}

/**
 * Exports the logs with the store's config sizes and attachment cache limit, and says when it
 * failed.
 *
 * Every Export Logs button goes through here, so each passes the config sizes -- without them the
 * header says `unknown`, which is also what a failed start honestly reports, and a button that
 * stopped passing them would look like one whose start failed. A failure is said with a toast
 * rather than left silent: the person is reporting a problem and needs to know the export did not
 * happen. Success says nothing; the save dialog or share sheet was the answer.
 */
export function useExportLogs(): LogExport {
  const actions = useSessionActions()
  const toasts = useToast()
  const [exporting, setExporting] = useState(false)
  return {
    canExport: requirePorts().logs.deliver !== null,
    exporting,
    start: () => {
      setExporting(true)
      void exportLogs({
        configSizes: actions.getConfigSizes,
        attachmentsLimit: () => actions.getCacheSettings().then((cache) => cache.limitBytes),
      })
        .then((outcome) => {
          if (outcome === 'failed') toasts.show(tr('errorUnknown'), { id: 'export-failed' })
        })
        .finally(() => {
          setExporting(false)
        })
    },
  }
}
