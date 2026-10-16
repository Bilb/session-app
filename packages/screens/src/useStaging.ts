import { requirePorts, type PickedFile } from '@session/app'
import { useCallback, useEffect, useRef, useState } from 'react'

import { letGo, stage, unstage, type SendRefusal, type StagingRefusal } from './staging'

function discard(files: readonly PickedFile[]): void {
  letGo(requirePorts().files, files, { sent: false })
}

const NOTHING_REFUSED: StagingRefusal = {
  tooLarge: [],
  overLimit: 0,
  unreadable: 0,
  sendRefused: 'none',
}

export interface StagingState {
  files: PickedFile[]
  /** What the last pick, drop or send turned away. The next replaces it, so it is current. */
  refused: StagingRefusal
  /** Bumped by every pick, drop or send refused, so a repeat is announced again. */
  refusal: number
  /** What a pick or drop gave, and how many items it could not read at all. */
  add: (picked: readonly PickedFile[], unreadable?: number) => void
  /**
   * Stages what a picker or a drop resolves to. `asked` is how many items it was given, where
   * known: any it did not hand back could not be read, and a failure could read none of them.
   */
  take: (chosen: Promise<readonly PickedFile[]>, asked?: number) => Promise<void>
  remove: (path: string) => void
  /** Empties the tray, deleting what it holds. Not for a send: the message needs the files. */
  clear: () => void
  /**
   * Takes what a message was sent with out of the tray, keeping the files, which the message now
   * owns, but not their previews. Anything staged since stays, a re-pick of a sent path included.
   */
  handOff: (sent: readonly PickedFile[]) => void
  /** Says a send was refused; what it held stays for another try. */
  refuseSend: (what: Exclude<SendRefusal, 'none'>) => void
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
  // A picker can resolve after the conversation closed, when nothing is left to stage onto.
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      discard(latest.current)
    }
  }, [])

  const add = useCallback((picked: readonly PickedFile[], unreadable = 0) => {
    // A cancelled picker hands back nothing, which is not a pick that should clear a notice.
    if (picked.length === 0 && unreadable === 0) return
    if (!mounted.current) {
      discard(picked)
      return
    }
    const { picksAreCopies, decodesHeic } = requirePorts().files
    const next = stage(latest.current, picked, { picksAreCopies, decodesHeic })
    latest.current = next.files
    setFiles(next.files)
    setRefused({ ...next.refused, unreadable })
    const anyRefused =
      next.refused.tooLarge.length > 0 || next.refused.overLimit > 0 || unreadable > 0
    if (anyRefused) setRefusal((count) => count + 1)
    discard(next.unused)
    for (const file of next.replaced) requirePorts().files.releasePreview(file)
  }, [])

  const take = useCallback(
    (chosen: Promise<readonly PickedFile[]>, asked?: number) =>
      chosen.then(
        (picked) => {
          add(picked, asked === undefined ? 0 : asked - picked.length)
        },
        () => {
          add([], asked ?? 1)
        },
      ),
    [add],
  )

  return {
    files,
    refused,
    refusal,
    add,
    take,
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
    handOff: (sent) => {
      // The unmount already let go of everything staged, these included.
      if (!mounted.current) return
      const handed = new Set(sent)
      letGo(
        requirePorts().files,
        latest.current.filter((file) => handed.has(file)),
        { sent: true },
      )
      latest.current = latest.current.filter((file) => !handed.has(file))
      setFiles(latest.current)
      setRefused(NOTHING_REFUSED)
    },
    refuseSend: (what) => {
      if (!mounted.current) return
      setRefused({ ...NOTHING_REFUSED, sendRefused: what })
      setRefusal((count) => count + 1)
    },
    dismiss: (kind) => {
      setRefused((current) => ({ ...current, [kind]: NOTHING_REFUSED[kind] }))
    },
  }
}
