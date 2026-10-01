import { requirePorts } from '@session/app'
import type { Message } from '@session/client'
import type { SessionActions } from '@session/state'

/**
 * Writes one attachment out to a folder somebody chose, and shows them where it went.
 *
 * Per attachment rather than per message: a set has no "the" attachment, and a call that quietly
 * wrote the first would be worse than one that did not exist. Exporting a whole set needs a
 * directory picker `FilesPort` does not have yet, and that is its own piece of work.
 */
export async function exportOne(
  message: Message,
  index: number,
  actions: Pick<SessionActions, 'exportAttachment'>,
): Promise<void> {
  const attachment = message.attachments.find((a) => a.index === index)
  const suggested = attachment?.filename ?? `attachment-${String(index + 1)}`
  try {
    const destination = await requirePorts().files.chooseExportLocation(
      suggested,
      attachment?.contentType,
    )
    if (destination === null) return
    const saved = await actions.exportAttachment({ messageId: message.id, index }, destination)
    await requirePorts().files.revealInFolder(saved)
  } catch {
    // Only a list row draws a failed export transfer, and a refusal before one starts (an expired
    // file, a destination refused) reaches no transfer at all.
    // TODO(#63): say an export failed as a toast, wherever it was started from.
  }
}
