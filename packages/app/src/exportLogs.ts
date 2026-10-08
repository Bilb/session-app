import {
  exportFileName,
  exportHeader,
  exportParts,
  planExport,
  type ExportFacts,
} from '@session/logging'

import { appLog } from './log'
import { requirePorts } from './ports'

export type ExportOutcome = 'exported' | 'cancelled' | 'unavailable' | 'failed'

/**
 * Everything the app has logged, as one compressed file handed to the person.
 *
 * The header is built here from the ports, so every platform's says the same things in the same
 * order; the bytes are the platform's to compress and deliver. The `export` marker goes in first,
 * so the file says when it was made and a reader can tell its last lines from what came after.
 *
 * Never throws: a screen offering this is one where something already went wrong, and a second
 * failure should be an outcome it can show rather than another unhandled rejection.
 */
export async function exportLogs(): Promise<ExportOutcome> {
  const { logs, diagnostics, build, network } = requirePorts()
  if (logs.deliver === null) return 'unavailable'
  try {
    appLog.marker('export', 'export')
    const [files, device] = await Promise.all([logs.retained(), diagnostics.snapshot()])
    const plan = planExport(files)
    const first = plan.included[0]
    const last = plan.included.at(-1)
    const span =
      first === undefined || last === undefined
        ? { firstLine: null, lastLine: null }
        : await logs.span(first.name, last.name)
    const now = Date.now()

    const facts: ExportFacts = {
      exportedAtMs: now,
      utcOffsetMinutes: -new Date(now).getTimezoneOffset(),
      version: build.version,
      buildNumber: build.buildNumber,
      commit: build.commit,
      variant: build.variant,
      install: device.install,
      platform: device.platform,
      osVersion: device.osVersion,
      model: device.model,
      locale: device.locale,
      network: network.name,
      networkType: device.networkType,
      memory: device.memory,
      ...(device.notifications === undefined ? {} : { notifications: device.notifications }),
      ...(device.permissions === undefined ? {} : { permissions: device.permissions }),
      storage: {
        databaseBytes: device.databaseBytes,
        attachmentsBytes: device.attachmentsBytes,
        attachmentsLimitBytes: null,
        freeBytes: device.freeBytes,
      },
      // libsession keeps the dumps in its own table and has no call that reports their sizes yet.
      configSizes: null,
      logs: { plan, ...span },
      redactions: appLog.sweepCounts(),
    }

    const name = exportFileName(device.platform, build.version, now)
    const delivered = await logs.deliver(name, exportParts(exportHeader(facts), plan))
    appLog.info('export', delivered ? 'export delivered' : 'export cancelled', {
      files: plan.included.length,
      bytes: plan.bytes,
    })
    return delivered ? 'exported' : 'cancelled'
  } catch (error) {
    appLog.error('export', 'export failed', {
      reason: error instanceof Error ? error.message : String(error),
    })
    return 'failed'
  }
}
