import type { PickedFile } from '@session/app'
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from '@session/basic-types'

/** What a pick or a drop left out, and why. */
export interface StagingRefusal {
  tooLarge: PickedFile[]
  /** How many were left out because the message was full. */
  overLimit: number
}

export interface Staging {
  files: PickedFile[]
  refused: StagingRefusal
}

/**
 * Adds what was picked or dropped to what is already staged, refusing what cannot be sent.
 *
 * In the order given, so the tray and the message read in the order somebody chose. A file already
 * staged is skipped rather than refused: choosing it twice is not a mistake worth a notice. A file
 * whose size the platform did not report is let through, since there is nothing to check it
 * against; the upload is what refuses it then.
 */
export function stage(staged: readonly PickedFile[], picked: readonly PickedFile[]): Staging {
  const files = [...staged]
  const seen = new Set(staged.map((file) => file.path))
  const tooLarge: PickedFile[] = []
  let overLimit = 0

  for (const file of picked) {
    if (seen.has(file.path)) continue
    if (file.size !== undefined && file.size > MAX_ATTACHMENT_BYTES) {
      tooLarge.push(file)
      continue
    }
    if (files.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
      overLimit += 1
      continue
    }
    seen.add(file.path)
    files.push(file)
  }

  return { files, refused: { tooLarge, overLimit } }
}

export function unstage(staged: readonly PickedFile[], path: string): PickedFile[] {
  return staged.filter((file) => file.path !== path)
}

export function isFull(staged: readonly PickedFile[]): boolean {
  return staged.length >= MAX_ATTACHMENTS_PER_MESSAGE
}
