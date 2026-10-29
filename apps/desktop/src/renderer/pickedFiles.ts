import type { PickedFile } from '@session/app'
import { isDisplayableImage, MAX_ATTACHMENTS_PER_MESSAGE } from '@session/basic-types'

/**
 * The page's own file chooser, rather than a dialog in main.
 *
 * It hands back `File`s, which is what a drop hands back too, so both reach the composer by one
 * path: the preload says where each one is on disk.
 */
export function chooseFiles(options: { multiple?: boolean; accept?: string }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = options.multiple ?? true
    if (options.accept !== undefined) input.accept = options.accept
    input.addEventListener('change', () => {
      resolve(Array.from(input.files ?? []))
    })
    input.addEventListener('cancel', () => {
      resolve([])
    })
    input.click()
  })
}

function isFile(item: unknown): item is File {
  return typeof File !== 'undefined' && item instanceof File
}

/** A pick that left the tray: its grants, to draw it and to send it, go with it. */
export function releasePreview(file: PickedFile): void {
  if (file.previewUrl !== undefined) void window.sessionDesktop.revokePreview(file.previewUrl)
  void window.sessionDesktop.releaseSend(file.path)
}

async function toPickedFile(file: File, preview: boolean): Promise<PickedFile | null> {
  const path = window.sessionDesktop.pathForFile(file)
  if (path === '' || !(await window.sessionDesktop.allowSend(file))) return null
  const contentType = file.type === '' ? undefined : file.type
  try {
    const previewUrl =
      preview && isDisplayableImage(contentType)
        ? ((await window.sessionDesktop.allowPreview(file)) ?? undefined)
        : undefined
    return {
      path,
      name: file.name,
      size: file.size,
      modifiedMs: file.lastModified,
      contentType,
      previewUrl,
    }
  } catch (error) {
    void window.sessionDesktop.releaseSend(path)
    throw error
  }
}

/**
 * What the composer stages. A file with no path on disk cannot be sent, so it is left out.
 *
 * Previews only for as many as one message takes: staging keeps no more from a single pick, and a
 * grant past that would only push out one the tray still draws.
 */
export async function toPickedFiles(items: readonly unknown[]): Promise<PickedFile[]> {
  const files = items.filter(isFile)
  const settled = await Promise.allSettled(
    files.map((file, at) => toPickedFile(file, at < MAX_ATTACHMENTS_PER_MESSAGE)),
  )
  const picked = settled.flatMap((result) =>
    result.status === 'fulfilled' && result.value !== null ? [result.value] : [],
  )
  const failed = settled.find((result) => result.status === 'rejected')
  if (failed !== undefined) {
    // Staging gets none of a pick that failed, so nothing else would let these go.
    for (const file of picked) releasePreview(file)
    throw failed.reason
  }
  return picked
}
