import type { PickedFile } from '@session/app'
import { isDisplayableImage } from '@session/basic-types'

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

async function toPickedFile(file: File): Promise<PickedFile | null> {
  const path = window.sessionDesktop.pathForFile(file)
  if (path === '') return null
  const contentType = file.type === '' ? undefined : file.type
  return {
    path,
    name: file.name,
    size: file.size,
    contentType,
    previewUrl: isDisplayableImage(contentType)
      ? ((await window.sessionDesktop.allowPreview(file)) ?? undefined)
      : undefined,
  }
}

/** What the composer stages. A file with no path on disk cannot be sent, so it is left out. */
export async function toPickedFiles(items: readonly unknown[]): Promise<PickedFile[]> {
  const picked = await Promise.all(items.filter(isFile).map(toPickedFile))
  return picked.filter((file) => file !== null)
}
