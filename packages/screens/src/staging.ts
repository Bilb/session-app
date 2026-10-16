import type { FilesPort, PickedFile } from '@session/app'
import {
  fitsAttachmentLimit,
  formatBytes,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type WithDecodesHeic,
} from '@session/basic-types'
import type { OutgoingAttachment } from '@session/client'

/** What the last refused send held: files, or only text. */
export type SendRefusal = 'none' | 'text' | 'files'

/** What the composer turned away: what a pick or a drop left out, or a send. */
export interface StagingRefusal {
  tooLarge: PickedFile[]
  /** How many were left out because the message was full. */
  overLimit: number
  /** How many could not be read at all: a drop with no file on disk, or a picker that failed. */
  unreadable: number
  /** Whether libsession refused the last send, whose text and files are still in the composer. */
  sendRefused: SendRefusal
}

export interface Staging {
  files: PickedFile[]
  refused: StagingRefusal
  /**
   * Picks that will not be staged, for their copy to go. A pick at a staged path is here only
   * when it is refused, its staged entry with it.
   */
  unused: PickedFile[]
  /**
   * Staged entries a re-pick of their path replaced, or removed once it grew past the limit:
   * their previews go. A replaced one's file stays; a removed one's goes with the pick in `unused`.
   */
  replaced: PickedFile[]
}

export interface StagingOptions extends WithDecodesHeic {
  /**
   * Whether every pick is a fresh copy, as on mobile, where the same photo picked twice never
   * shares a path. Only then do a name and size say two picks are one file.
   */
  picksAreCopies: boolean
}

function sameFile(
  a: PickedFile,
  b: PickedFile,
  { picksAreCopies }: Pick<StagingOptions, 'picksAreCopies'>,
): boolean {
  if (a.path === b.path) return true
  return picksAreCopies && a.size !== undefined && a.size === b.size && a.name === b.name
}

/**
 * Adds what was picked or dropped to what is already staged, refusing what cannot be sent.
 *
 * In the order given, so the tray and the message read in the order somebody chose. A file already
 * staged is not refused: choosing it twice is not a mistake worth a notice. One picked again at
 * its path replaces the staged entry, so a file edited since is drawn as it is now. What may be
 * staged at all is `fitsAttachmentLimit`'s to say.
 */
export function stage(
  staged: readonly PickedFile[],
  picked: readonly PickedFile[],
  options: StagingOptions,
): Staging {
  const files = [...staged]
  const tooLarge: PickedFile[] = []
  const unused: PickedFile[] = []
  const replaced: PickedFile[] = []
  let overLimit = 0

  for (const file of picked) {
    const at = files.findIndex((staged) => sameFile(staged, file, options))
    const already = files[at]
    const fits = fitsAttachmentLimit(file, options)
    if (already !== undefined && already.path !== file.path) {
      unused.push(file)
      continue
    }
    if (already !== undefined) {
      replaced.push(already)
      if (fits) {
        files[at] = file
        continue
      }
      // Grown past the limit since it was staged: refused now, not at the upload.
      files.splice(at, 1)
    }
    if (!fits) {
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

  return {
    files,
    refused: { tooLarge, overLimit, unreadable: 0, sendRefused: 'none' },
    unused,
    replaced,
  }
}

export function sizeOf(file: PickedFile): string | undefined {
  return file.size === undefined ? undefined : formatBytes(file.size)
}

export function unstage(staged: readonly PickedFile[], path: string): PickedFile[] {
  return staged.filter((file) => file.path !== path)
}

export function isFull(staged: readonly PickedFile[]): boolean {
  return staged.length >= MAX_ATTACHMENTS_PER_MESSAGE
}

/** What a send hands libsession for a staged pick: a copy the app made is given to it outright. */
export function outgoingAttachment(
  file: PickedFile,
  { picksAreCopies }: Pick<StagingOptions, 'picksAreCopies'>,
): OutgoingAttachment {
  return {
    path: file.path,
    // A mobile copy's own name is prefixed to keep it apart from the others.
    filename: file.name,
    ...(file.contentType === undefined ? {} : { contentType: file.contentType }),
    ...(picksAreCopies ? { takeFile: true } : {}),
  }
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
