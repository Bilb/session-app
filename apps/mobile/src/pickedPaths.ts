import type { PickedFile } from '@session/app'

/** A picked file's name where the picker gave none: the last segment of its copy. */
export function lastSegment(uri: string): string {
  return decodeURIComponent(uri.split('/').pop() ?? '')
}

/** Keeps every pick or none: one failing partway discards the copies already kept. */
export function keepAll<T>(
  assets: readonly T[],
  keep: (asset: T) => PickedFile,
  discard: (path: string) => void,
): PickedFile[] {
  const kept: PickedFile[] = []
  try {
    for (const asset of assets) kept.push(keep(asset))
  } catch (error) {
    for (const file of kept) discard(file.path)
    throw error
  }
  return kept
}
