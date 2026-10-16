import type { FilesPort, PickedFile } from '@session/app'
import {
  encryptedAttachmentSize,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '@session/basic-types'

/** What a pick or a drop left out, and why. */
export interface StagingRefusal {
  tooLarge: PickedFile[]
  /** How many were left out because the message was full. */
  overLimit: number
  /** How many could not be read at all: a drop with no file on disk, or a picker that failed. */
  unreadable: number
}

export interface Staging {
  files: PickedFile[]
  refused: StagingRefusal
  /**
   * Picks that will not be staged and are copies of their own, for the copy to go. Never a pick
   * whose path is already staged: that path is the staged file's.
   */
  unused: PickedFile[]
}

export interface StagingOptions {
  /**
   * Whether every pick is a fresh copy, as on mobile, where the same photo picked twice never
   * shares a path. Only then do a name and size say two picks are one file.
   */
  picksAreCopies: boolean
}

function sameFile(a: PickedFile, b: PickedFile, { picksAreCopies }: StagingOptions): boolean {
  if (a.path === b.path) return true
  return picksAreCopies && a.size !== undefined && a.size === b.size && a.name === b.name
}

/**
 * Adds what was picked or dropped to what is already staged, refusing what cannot be sent.
 *
 * In the order given, so the tray and the message read in the order somebody chose. A file already
 * staged is skipped rather than refused: choosing it twice is not a mistake worth a notice. A file
 * whose size the platform did not report is let through, since there is nothing to check it
 * against; the upload is what refuses it then.
 */
export function stage(
  staged: readonly PickedFile[],
  picked: readonly PickedFile[],
  options: StagingOptions,
): Staging {
  const files = [...staged]
  const tooLarge: PickedFile[] = []
  const unused: PickedFile[] = []
  let overLimit = 0

  for (const file of picked) {
    const already = files.find((staged) => sameFile(staged, file, options))
    if (already !== undefined) {
      if (already.path !== file.path) unused.push(file)
      continue
    }
    if (file.size !== undefined && encryptedAttachmentSize(file.size) > MAX_ATTACHMENT_BYTES) {
      tooLarge.push(file)
      unused.push(file)
      continue
    }
    if (files.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
      overLimit += 1
      unused.push(file)
      continue
    }
    files.push(file)
  }

  return { files, refused: { tooLarge, overLimit, unreadable: 0 }, unused }
}

export function unstage(staged: readonly PickedFile[], path: string): PickedFile[] {
  return staged.filter((file) => file.path !== path)
}

export function isFull(staged: readonly PickedFile[]): boolean {
  return staged.length >= MAX_ATTACHMENTS_PER_MESSAGE
}

/**
 * Lets go of picks leaving the tray: every one's preview, and, unless a message being sent took
 * them, the copy the app made.
 */
export function letGo(
  port: Pick<FilesPort, 'discardPicked' | 'releasePreview'>,
  files: readonly PickedFile[],
  { sent }: { sent: boolean },
): void {
  for (const file of files) {
    port.releasePreview(file)
    if (!sent) port.discardPicked(file)
  }
}
