import { requirePorts, type PickedFile } from '@session/app'
import type { SendPlan } from '@session/client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { letGo, stage, unstage, type SendRefusal, type StagingRefusal } from './staging'

function discard(files: readonly PickedFile[]): void {
  letGo(requirePorts().files, files, { sent: false })
}

const NOTHING_REFUSED: StagingRefusal = {
  tooLarge: [],
  tooLargeToDecode: [],
  unopenable: [],
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
  /** From `beginSend` until `handOff` or `refuseSend`: the tray is the message's, and locked. */
  sending: boolean
  /**
   * Whether a pick is still waiting on libsession's plan for its files, which are staged or
   * refused once it answers: no Send until then, or the message would go without them.
   */
  planning: boolean
  beginSend: () => void
  /**
   * What a pick or drop gave, and how many items it could not read at all. Staged in the order
   * given once every file's plan is in, after any pick still waiting.
   */
  add: (picked: readonly PickedFile[], unreadable?: number) => Promise<void>
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

/** libsession's plan for sending a file, which says whether it may be staged. */
export type PlanSend = (file: PickedFile) => Promise<SendPlan>

/**
 * What the composer has staged, and what it most recently refused.
 *
 * Staged files that are still here when the conversation closes are let go then, since nothing
 * else would delete a picker's copy of them.
 */
export function useStaging(planSend: PlanSend): StagingState {
  const [files, setFiles] = useState<PickedFile[]>([])
  const [refused, setRefused] = useState<StagingRefusal>(NOTHING_REFUSED)
  const [refusal, setRefusal] = useState(0)
  const [sending, setSending] = useState(false)
  const [planning, setPlanning] = useState(0)
  const plan = useRef(planSend)
  plan.current = planSend
  // Picks are staged one after another, so a slow plan cannot reorder the tray.
  const queue = useRef<Promise<void>>(Promise.resolve())
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

  const apply = useCallback(
    (
      picked: readonly PickedFile[],
      plans: ReadonlyMap<PickedFile, SendPlan>,
      unreadable: number,
    ) => {
      if (!mounted.current) {
        discard(picked)
        return
      }
      const { picksAreCopies } = requirePorts().files
      const next = stage(latest.current, picked, {
        picksAreCopies,
        // A plan that could not be asked for at all is a file nothing can say will send.
        planOf: (file) => plans.get(file) ?? 'unreadable',
      })
      latest.current = next.files
      setFiles(next.files)
      setRefused({ ...next.refused, unreadable })
      const anyRefused =
        next.refused.tooLarge.length > 0 ||
        next.refused.tooLargeToDecode.length > 0 ||
        next.refused.unopenable.length > 0 ||
        next.refused.overLimit > 0 ||
        unreadable > 0
      if (anyRefused) setRefusal((count) => count + 1)
      discard(next.unused)
      for (const file of next.replaced) requirePorts().files.releasePreview(file)
    },
    [],
  )

  const add = useCallback(
    (picked: readonly PickedFile[], unreadable = 0): Promise<void> => {
      // A cancelled picker hands back nothing, which is not a pick that should clear a notice.
      if (picked.length === 0 && unreadable === 0) return Promise.resolve()
      if (!mounted.current) {
        discard(picked)
        return Promise.resolve()
      }
      setPlanning((count) => count + 1)
      // Through a then, so a planner that throws rather than rejects cannot leave `planning` up.
      const plans = Promise.all(
        picked.map((file) =>
          Promise.resolve(file)
            .then(plan.current)
            .then(
              (answer): [PickedFile, SendPlan] => [file, answer],
              (): [PickedFile, SendPlan] => [file, 'unreadable'],
            ),
        ),
      ).then((answers) => new Map(answers))
      const staged = queue.current
        .then(() => plans)
        .then((answers) => {
          apply(picked, answers, unreadable)
        })
        .finally(() => {
          setPlanning((count) => count - 1)
        })
      queue.current = staged.catch(() => undefined)
      return staged
    },
    [apply],
  )

  const take = useCallback(
    (chosen: Promise<readonly PickedFile[]>, asked?: number) =>
      chosen.then(
        (picked) => add(picked, asked === undefined ? 0 : asked - picked.length),
        () => add([], asked ?? 1),
      ),
    [add],
  )

  return {
    files,
    refused,
    refusal,
    sending,
    planning: planning > 0,
    beginSend: () => {
      setSending(true)
    },
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
      setSending(false)
    },
    refuseSend: (what) => {
      if (!mounted.current) return
      setRefused({ ...NOTHING_REFUSED, sendRefused: what })
      setRefusal((count) => count + 1)
      setSending(false)
    },
    dismiss: (kind) => {
      setRefused((current) => ({ ...current, [kind]: NOTHING_REFUSED[kind] }))
    },
  }
}
