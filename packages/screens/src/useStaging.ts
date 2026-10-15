import { requirePorts, type PickedFile } from '@session/app'
import { useCallback, useEffect, useRef, useState } from 'react'

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
  /** Bumped by every pick or drop that refused something, so a repeat is announced again. */
  refusal: number
  /** What a pick or drop gave, and how many items it could not read at all. */
  add: (picked: readonly PickedFile[], unreadable?: number) => void
  remove: (path: string) => void
  /** Empties the tray, deleting what it holds. Not for a send: the message needs the files. */
  clear: () => void
  /** Empties the tray and keeps the files, which a message being sent now owns. */
  handOff: () => PickedFile[]
  dismiss: (kind: keyof StagingRefusal) => void
}

/**
 * What the composer has staged, and what it most recently refused.
 *
 * Staged files that are still here when the conversation closes are let go then, since nothing
 * else would delete a picker's copy of them.
 */
export function useStaging(): StagingState {
  const [files, setFiles] = useState<PickedFile[]>([])
  const [refused, setRefused] = useState<StagingRefusal>(NOTHING_REFUSED)
  const [refusal, setRefusal] = useState(0)
  // A picker resolves after the render that opened it, so it stages onto what is there by then.
  const latest = useRef(files)
  latest.current = files

  useEffect(
    () => () => {
      discard(latest.current)
    },
    [],
  )

  const add = useCallback((picked: readonly PickedFile[], unreadable = 0) => {
    // A cancelled picker hands back nothing, which is not a pick that should clear a notice.
    if (picked.length === 0 && unreadable === 0) return
    const next = stage(latest.current, picked, {
      picksAreCopies: requirePorts().files.picksAreCopies,
    })
    latest.current = next.files
    setFiles(next.files)
    setRefused({ ...next.refused, unreadable })
    const anyRefused =
      next.refused.tooLarge.length > 0 || next.refused.overLimit > 0 || unreadable > 0
    if (anyRefused) setRefusal((count) => count + 1)
    discard(next.unused)
  }, [])

  return {
    files,
    refused,
    refusal,
    add,
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
    handOff: () => {
      const handed = latest.current
      latest.current = []
      setFiles([])
      setRefused(NOTHING_REFUSED)
      return handed
    },
    dismiss: (kind) => {
      setRefused((current) => ({ ...current, [kind]: NOTHING_REFUSED[kind] }))
    },
  }
}
