import { requirePorts, type PickedFile } from '@session/app'
import { useCallback, useRef, useState } from 'react'

import { stage, unstage, type StagingRefusal } from './staging'

function discard(files: readonly PickedFile[]): void {
  const { files: port } = requirePorts()
  for (const file of files) port.discardPicked(file)
}

const NOTHING_REFUSED: StagingRefusal = { tooLarge: [], overLimit: 0, unreadable: 0 }

export interface StagingState {
  files: PickedFile[]
  /** What the last pick or drop left out. Replaced by the next one, so it is always current. */
  refused: StagingRefusal
  add: (picked: readonly PickedFile[]) => void
  /** Records that `count` items given to the composer could not be read. */
  refuseUnreadable: (count: number) => void
  remove: (path: string) => void
  clear: () => void
  dismiss: (kind: keyof StagingRefusal) => void
}

/** What the composer has staged, and what it most recently refused. */
export function useStaging(): StagingState {
  const [files, setFiles] = useState<PickedFile[]>([])
  const [refused, setRefused] = useState<StagingRefusal>(NOTHING_REFUSED)
  // A picker resolves after the render that opened it, so it stages onto what is there by then.
  const latest = useRef(files)
  latest.current = files

  const add = useCallback((picked: readonly PickedFile[]) => {
    // A cancelled picker hands back nothing, which is not a pick that should clear a notice.
    if (picked.length === 0) return
    const next = stage(latest.current, picked)
    latest.current = next.files
    setFiles(next.files)
    setRefused(next.refused)
    discard(next.unused)
  }, [])

  return {
    files,
    refused,
    add,
    // Merged rather than replacing: a drop can bring readable files and refusals together.
    refuseUnreadable: (count) => {
      setRefused((current) => ({ ...current, unreadable: count }))
    },
    remove: (path) => {
      discard(latest.current.filter((file) => file.path === path))
      latest.current = unstage(latest.current, path)
      setFiles(latest.current)
    },
    clear: () => {
      discard(latest.current)
      latest.current = []
      setFiles([])
      setRefused(NOTHING_REFUSED)
    },
    dismiss: (kind) => {
      setRefused((current) => ({ ...current, [kind]: NOTHING_REFUSED[kind] }))
    },
  }
}
