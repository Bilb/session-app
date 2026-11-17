import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { memoryPorts, resetPorts, setPorts, type PickedFile } from '@session/app'
import type { SendPlan } from '@session/client'
import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useStaging, type PlanSend } from '#src/useStaging'

/**
 * One render of a hook, without a renderer: its state writes are recorded rather than applied,
 * and its effects run on `mount` and clean up on `unmount`.
 */
const hook = vi.hoisted(() => ({
  writes: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  cleanups: [] as (() => void)[],
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: (initial: unknown) => [
    initial,
    (value: unknown) => {
      hook.writes.push(value)
    },
  ],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    hook.effects.push(effect)
  },
}))

function mount(planSend: PlanSend = () => Promise.resolve('as-is')) {
  const staging = useStaging(planSend)
  for (const effect of hook.effects.splice(0)) {
    const cleanup = effect()
    if (cleanup !== undefined) hook.cleanups.push(cleanup)
  }
  return staging
}

function unmount(): void {
  for (const cleanup of hook.cleanups.splice(0)) cleanup()
}

/** A plan that answers when the test says so. */
function pending(): { planSend: PlanSend; answer: (plan: SendPlan) => void } {
  let answer: (plan: SendPlan) => void = () => undefined
  const plan = new Promise<SendPlan>((resolve) => {
    answer = resolve
  })
  return { planSend: () => plan, answer: (value) => answer(value) }
}

/** What the state updaters written so far make of 0: a pick's `planning` is +1, then -1. */
function counted(): number[] {
  return hook.writes
    .filter((value): value is (count: number) => number => typeof value === 'function')
    .map((update) => update(0))
}

const released: (string | undefined)[] = []
const discarded: string[] = []

function picked(name: string, previewUrl?: string): PickedFile {
  return { path: `/home/a/${name}`, name, previewUrl }
}

beforeEach(() => {
  const ports = memoryPorts()
  setPorts({
    ...ports,
    files: {
      ...ports.files,
      releasePreview: (file) => released.push(file.previewUrl),
      discardPicked: (file) => discarded.push(file.path),
    },
  })
})

afterEach(() => {
  unmount()
  resetPorts()
  hook.writes.length = 0
  released.length = 0
  discarded.length = 0
})

describe('the composer staging', () => {
  it('lets go of the preview a re-pick of a staged path replaced, keeping its file', async () => {
    const staging = mount()
    await staging.add([picked('photo.jpg', 'session-media://picked/old')])
    const repicked = picked('photo.jpg', 'session-media://picked/new')
    await staging.add([repicked])
    expect(released).toEqual(['session-media://picked/old'])
    expect(discarded).toEqual([])
    staging.handOff([repicked])
    expect(released).toEqual(['session-media://picked/old', 'session-media://picked/new'])
    expect(discarded).toEqual([])
  })

  it('hands over only what a message was sent with, and keeps what was staged since', async () => {
    const staging = mount()
    const a = picked('a.jpg')
    await staging.add([a, picked('b.jpg')])
    staging.handOff([a])
    expect(hook.writes).toContainEqual([picked('b.jpg')])
    expect(discarded).toEqual([])
  })

  it('keeps a re-pick of a path whose earlier pick is being sent', async () => {
    const staging = mount()
    const sent = picked('a.jpg', 'session-media://picked/sent')
    await staging.add([sent])
    const again = picked('a.jpg', 'session-media://picked/again')
    await staging.add([again])
    hook.writes.length = 0
    released.length = 0
    staging.handOff([sent])
    expect(hook.writes).toContainEqual([again])
    expect(released).toEqual([])
  })

  it('lets go of nothing twice when a send lands after the conversation closed', async () => {
    const staging = mount()
    const a = picked('a.jpg', 'session-media://picked/a')
    await staging.add([a])
    unmount()
    expect(released).toEqual(['session-media://picked/a'])
    hook.writes.length = 0
    staging.handOff([a])
    staging.refuseSend('files')
    expect(released).toEqual(['session-media://picked/a'])
    expect(hook.writes).toEqual([])
  })

  it('keeps a refused send staged and says so', async () => {
    const staging = mount()
    await staging.add([picked('a.jpg')])
    staging.refuseSend('files')
    // Said once every staged file's plan, asked again, still sends.
    await vi.waitFor(() => {
      expect(hook.writes).toContainEqual(expect.objectContaining({ sendRefused: 'files' }))
    })
    expect(hook.writes).toContainEqual({
      tooLarge: [],
      tooLargeToDecode: [],
      unopenable: [],
      overLimit: 0,
      unreadable: 0,
      sendRefused: 'files',
    })
    expect(discarded).toEqual([])
  })

  it('lets go of what a picker hands back after the conversation closed', async () => {
    const staging = mount()
    unmount()
    await staging.add([picked('late.jpg', 'session-media://picked/late')], 1)
    expect(hook.writes).toEqual([])
    expect(released).toEqual(['session-media://picked/late'])
    expect(discarded).toEqual(['/home/a/late.jpg'])
  })

  it('refuses a file whose planner throws, and stops planning', async () => {
    const staging = mount(() => {
      throw new Error('planner')
    })
    await staging.add([picked('a.jpg')])
    expect(counted()).toContain(-1)
    expect(hook.writes).toContainEqual(expect.objectContaining({ unopenable: [picked('a.jpg')] }))
    expect(hook.writes).not.toContainEqual([picked('a.jpg')])
  })

  it('lets go of a pick whose plan answers after the conversation closed', async () => {
    const plan = pending()
    const staging = mount(plan.planSend)
    const staged = staging.add([picked('late.jpg')])
    unmount()
    hook.writes.length = 0
    plan.answer('as-is')
    await staged
    expect(discarded).toEqual(['/home/a/late.jpg'])
    expect(hook.writes).not.toContainEqual([picked('late.jpg')])
  })

  it('stages a pick still planning onto what clear left, bringing back nothing it cleared', async () => {
    const plan = pending()
    let planSend: PlanSend = () => Promise.resolve('as-is')
    const staging = mount((file) => planSend(file))
    await staging.add([picked('a.jpg')])
    planSend = plan.planSend
    const staged = staging.add([picked('b.jpg')])
    staging.clear()
    expect(discarded).toEqual(['/home/a/a.jpg'])
    plan.answer('as-is')
    await staged
    expect(hook.writes.at(-1)).not.toEqual(expect.arrayContaining([picked('a.jpg')]))
    expect(hook.writes).toContainEqual([picked('b.jpg')])
    expect(discarded).toEqual(['/home/a/a.jpg'])
  })

  it('stages a pick still planning without the file removed meanwhile', async () => {
    const plan = pending()
    let planSend: PlanSend = () => Promise.resolve('as-is')
    const staging = mount((file) => planSend(file))
    await staging.add([picked('a.jpg'), picked('b.jpg')])
    planSend = plan.planSend
    const staged = staging.add([picked('c.jpg')])
    staging.remove('/home/a/a.jpg')
    plan.answer('as-is')
    await staged
    expect(hook.writes).toContainEqual([picked('b.jpg'), picked('c.jpg')])
    expect(discarded).toEqual(['/home/a/a.jpg'])
  })

  it('refuses a drop that fails as unreadable, as it does a picker that fails', async () => {
    const staging = mount()
    await staging.take(Promise.reject(new Error('allowPreview')), 3)
    await staging.take(Promise.reject(new Error('picker')))
    const refusals = hook.writes.filter((value) => typeof value === 'object')
    expect(refusals).toContainEqual({
      tooLarge: [],
      tooLargeToDecode: [],
      unopenable: [],
      overLimit: 0,
      unreadable: 3,
      sendRefused: 'none',
    })
    expect(refusals).toContainEqual({
      tooLarge: [],
      tooLargeToDecode: [],
      unopenable: [],
      overLimit: 0,
      unreadable: 1,
      sendRefused: 'none',
    })
  })

  it('counts what a drop could not hand back as unreadable', async () => {
    const staging = mount()
    await staging.take(Promise.resolve([picked('a.jpg')]), 3)
    expect(hook.writes).toContainEqual({
      tooLarge: [],
      tooLargeToDecode: [],
      unopenable: [],
      overLimit: 0,
      unreadable: 2,
      sendRefused: 'none',
    })
  })

  it('refuses a drop while a send is out, as the tray does', () => {
    const screen = readFileSync(join(import.meta.dirname, '../src/ConversationScreen.tsx'), 'utf8')
    expect(screen).toMatch(/<DropZone\s+(\/\/[^\n]*\s+)?accepting=\{!staging\.sending\}/)
  })

  it('is how both a pick and a drop are staged', () => {
    const source = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8')
    expect(source('Composer.tsx')).toContain('staging.take(chosen)')
    expect(source('ConversationScreen.tsx')).toContain(
      'staging.take(requirePorts().files.droppedFiles(items)',
    )
    for (const file of ['Composer.tsx', 'ConversationScreen.tsx'])
      expect(source(file)).not.toContain('staging.add(')
  })
})
